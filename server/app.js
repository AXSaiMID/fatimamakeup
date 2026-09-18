import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { unlink, writeFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { schemas, settingsSchema } from './content.js';
import { createStore } from './store.js';

const scrypt = promisify(scryptCallback);
const hashToken = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(180), password: z.string().min(12, 'A senha deve ter pelo menos 12 caracteres.').max(128) });
async function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`; }
async function verifyPassword(password, hash) { const [salt, key] = hash.split(':'); return equal((await scrypt(password, salt, 64)).toString('hex'), key); }

export function createApp(options = {}) {
  const store = createStore(options.dataDir);
  const { db } = store;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '200kb' }));
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Custom header blocks cross-origin simple requests, Origin guards same-site siblings.
    if (req.get('X-FC-Request') !== '1') return res.status(403).json({ error: 'Requisição não autorizada.' });
    const origin = req.get('Origin');
    if (origin) {
      try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origem não autorizada.' }); }
      catch { return res.status(403).json({ error: 'Origem inválida.' }); }
    }
    next();
  });
  const attempts = new Map();
  function rateLimit(req, res, next) {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    if (++entry.count > 20) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
    attempts.set(key, entry); next();
  }
  function cookie(req, res, value, age) {
    res.cookie('fc_session', value, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/', maxAge: age });
  }
  function newSession(req, res, user) {
    const raw = randomBytes(32).toString('hex'); const csrf = randomBytes(24).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token,user_id,csrf,expires) VALUES (?,?,?,?)').run(hashToken(raw), user.id, csrf, Date.now() + 8 * 3600_000);
    cookie(req, res, raw, 8 * 3600_000);
    return { email: user.email, csrf };
  }
  function session(req) {
    const raw = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('fc_session='))?.slice(11);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return db.prepare('SELECT sessions.*,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(hashToken(raw), Date.now());
  }
  function auth(req, res, next) {
    req.session = session(req);
    if (!req.session) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
    if (!['GET', 'HEAD'].includes(req.method) && !equal(req.get('X-CSRF-Token'), req.session.csrf)) return res.status(403).json({ error: 'Atualize a página e tente novamente.' });
    next();
  }
  function knownImages(data) {
    const images = ['image', 'heroImage', 'aboutImage'].map(key => data[key]).filter(Boolean);
    for (const url of images) {
      const builtins = ['/images/hero.jpg', '/images/social.jpg', '/images/bridal.jpg', '/images/beauty.jpg'];
      if (!builtins.includes(url) && !db.prepare('SELECT id FROM media WHERE url=?').get(url)) throw Object.assign(new Error('Selecione uma imagem existente na biblioteca.'), { status: 400 });
    }
  }
  const setupNeeded = () => !db.prepare('SELECT id FROM users LIMIT 1').get();
  app.get('/api/auth/session', (req, res) => { const active = session(req); res.json({ setupRequired: setupNeeded(), user: active ? { email: active.email, csrf: active.csrf } : null }); });
  app.post('/api/auth/setup', rateLimit, async (req, res) => {
    if (!setupNeeded()) return res.status(409).json({ error: 'O acesso administrativo já foi configurado.' });
    if (!equal(req.body.code, store.setupToken())) return res.status(403).json({ error: 'Código de ativação inválido.' });
    const input = credentials.parse(req.body);
    const hash = await passwordHash(input.password);
    // Recheck after async work so concurrent setup requests cannot create multiple owners.
    if (!setupNeeded()) return res.status(409).json({ error: 'O acesso administrativo já foi configurado.' });
    const user = { id: randomUUID(), email: input.email };
    db.prepare('INSERT INTO users (id,email,hash) VALUES (?,?,?)').run(user.id, user.email, hash);
    await unlink(store.tokenFile).catch(() => {});
    res.status(201).json(newSession(req, res, user));
  });
  app.post('/api/auth/login', rateLimit, async (req, res) => {
    const input = z.object({ email: z.string().trim().toLowerCase().max(180), password: z.string().max(128) }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
    const valid = await verifyPassword(input.password, user?.hash || `${'a'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !valid) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    res.json(newSession(req, res, user));
  });
  app.post('/api/auth/logout', auth, (req, res) => { db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token); cookie(req, res, '', 0); res.json({ ok: true }); });
  app.post('/api/auth/password', auth, rateLimit, async (req, res) => {
    const input = z.object({ currentPassword: z.string().max(128), password: credentials.shape.password }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user_id);
    if (!await verifyPassword(input.currentPassword, user.hash)) return res.status(400).json({ error: 'A senha atual está incorreta.' });
    const hash = await passwordHash(input.password);
    db.prepare('UPDATE users SET hash=? WHERE id=?').run(hash, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    res.json(newSession(req, res, user));
  });
  app.get('/api/site', (req, res) => {
    const settings = store.settings(); delete settings.revision;
    const published = name => store.list(name).filter(item => item.published).map(({ revision, created, updated, published, ...item }) => item);
    res.json({ settings, products: settings.catalogEnabled ? published('products') : [], gallery: published('gallery'), services: published('services') });
  });
  app.use('/api/admin', auth);
  const builtins = [ ['hero', 'Editorial natural', 1536, 1024], ['social', 'Maquiagem social', 512, 1024], ['bridal', 'Noivas', 512, 1024], ['beauty', 'Glam', 512, 1024] ].map(([id, name, width, height]) => ({ id, name: `${name} · ilustrativa IA`, url: `/images/${id}.jpg`, width, height, builtin: true }));
  app.get('/api/admin/content', (req, res) => res.json({ settings: store.settings(), products: store.list('products'), services: store.list('services'), gallery: store.list('gallery'), media: [...db.prepare('SELECT * FROM media ORDER BY created DESC').all(), ...builtins] }));
  app.put('/api/admin/settings', (req, res) => {
    const data = settingsSchema.parse(req.body); knownImages(data);
    const revision = z.number().int().positive().parse(req.body.revision);
    const result = db.prepare('UPDATE settings SET data=?, revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(data), revision);
    if (!result.changes) return res.status(409).json({ error: 'O conteúdo mudou em outra aba. Recarregue o painel antes de salvar.' });
    res.json(store.settings());
  });
  app.param('collection', (req, res, next, collection) => {
    if (!Object.hasOwn(schemas, collection)) return res.status(404).json({ error: 'Coleção não encontrada.' });
    next();
  });
  app.post('/api/admin/entries/:collection', (req, res) => {
    const data = schemas[req.params.collection].parse(req.body); knownImages(data);
    res.status(201).json(store.insert(req.params.collection, data));
  });
  app.put('/api/admin/entries/:collection/:id', (req, res) => {
    const data = schemas[req.params.collection].parse(req.body); knownImages(data);
    const revision = z.number().int().positive().parse(req.body.revision);
    const result = db.prepare('UPDATE entries SET data=?,revision=revision+1,updated=? WHERE id=? AND collection=? AND revision=?').run(JSON.stringify(data), new Date().toISOString(), req.params.id, req.params.collection, revision);
    if (!result.changes) return res.status(409).json({ error: 'Este item mudou ou foi removido. Recarregue o painel.' });
    res.json(store.list(req.params.collection).find(item => item.id === req.params.id));
  });
  app.delete('/api/admin/entries/:collection/:id', (req, res) => {
    const revision = z.number().int().positive().parse(req.body.revision);
    const result = db.prepare('DELETE FROM entries WHERE id=? AND collection=? AND revision=?').run(req.params.id, req.params.collection, revision);
    if (!result.changes) return res.status(409).json({ error: 'O item mudou ou já foi removido. Recarregue o painel.' });
    res.json({ ok: true });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } });
  app.post('/api/admin/media', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Selecione uma imagem JPG, PNG ou WebP.' });
    const totalBytes = db.prepare('SELECT COALESCE(SUM(bytes),0) AS total FROM media').get().total;
    if (totalBytes > 500 * 1024 * 1024) return res.status(413).json({ error: 'Limite de 500 MB atingido. Exclua imagens sem uso.' });
    let buffer, info;
    try {
      const processor = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
      const metadata = await processor.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('format');
      ({ data: buffer, info } = await processor.rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true }));
    } catch { return res.status(400).json({ error: 'Imagem inválida. Use JPG, PNG ou WebP, até 10 MB e 40 megapixels.' }); }
    const id = randomUUID(); const url = `/uploads/${id}.webp`; const path = join(store.dir, 'uploads', `${id}.webp`);
    await writeFile(path, buffer, { mode: 0o600 });
    const name = req.file.originalname.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 120) || 'Imagem';
    try { db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?)').run(id, name, url, info.width, info.height, info.size, new Date().toISOString()); }
    catch (error) { await unlink(path).catch(() => {}); throw error; }
    res.status(201).json(db.prepare('SELECT * FROM media WHERE id=?').get(id));
  });
  app.delete('/api/admin/media/:id', async (req, res) => {
    const media = db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);
    if (!media) return res.status(404).json({ error: 'Imagem não encontrada ou protegida.' });
    const settings = store.settings();
    const used = [settings.heroImage, settings.aboutImage, ...['products', 'gallery', 'services'].flatMap(name => store.list(name).map(item => item.image))].includes(media.url);
    if (used) return res.status(409).json({ error: 'Esta imagem está em uso. Troque-a ou remova o item que a utiliza antes de excluir.' });
    // Remove metadata first: public serving verifies metadata on each request.
    db.prepare('DELETE FROM media WHERE id=?').run(media.id);
    await unlink(join(store.dir, 'uploads', `${media.id}.webp`)).catch(() => {});
    res.json({ ok: true });
  });
  app.get('/api/admin/export', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="fatima-correa-conteudo.json"');
    res.json({ version: 1, exportedAt: new Date().toISOString(), settings: store.settings(), products: store.list('products'), services: store.list('services'), gallery: store.list('gallery'), media: db.prepare('SELECT * FROM media').all(), note: 'Exportação de conteúdo e referências. Faça backup da pasta DATA_DIR para incluir imagens e banco completos.' });
  });
  app.get('/uploads/:file', async (req, res) => {
    if (!/^[a-f0-9-]+\.webp$/.test(req.params.file) || !db.prepare('SELECT id FROM media WHERE url=?').get(`/uploads/${req.params.file}`)) return res.sendStatus(404);
    const file = join(store.dir, 'uploads', req.params.file);
    await stat(file);
    res.type('webp').set('Cache-Control', 'public, max-age=86400').sendFile(file);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Revise os campos informados.', details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) });
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Envie uma imagem por vez, de até 10 MB.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo muito grande.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'JSON inválido.' });
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Falha no servidor:', error.message);
    res.status(500).json({ error: 'Não foi possível concluir. Tente novamente.' });
  });
  return { app, store };
}
