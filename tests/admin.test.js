import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../server/app.js';

const password = 'Test-only-password-!123';
test('Admin: autenticação, segurança, catálogo, mídia e persistência', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fatima-test-'));
  let { app, store } = createApp({ dataDir: dir });
  const agent = request.agent(app); let csrf;
  const mutate = (method, path) => agent[method](path).set('X-FC-Request', '1').set('X-CSRF-Token', csrf || '');
  try {
    await t.test('não expõe painel, produtos privados nem código de ativação', async () => {
      const session = await request(app).get('/api/auth/session').expect(200);
      assert.deepEqual(session.body, { setupRequired: true, user: null });
      await request(app).get('/api/admin/content').expect(401);
      const site = await request(app).get('/api/site').expect(200);
      assert.equal(site.body.products.length, 0); assert.equal(site.body.services.length, 3);
      assert.equal(site.body.settings.revision, undefined);
    });
    await t.test('primeiro acesso exige código, senha forte e cabeçalho de origem', async () => {
      await agent.post('/api/auth/setup').send({}).expect(403);
      await mutate('post', '/api/auth/setup').send({ code: 'incorrect', email: 'admin@example.com', password }).expect(403);
      await mutate('post', '/api/auth/setup').send({ code: store.setupToken(), email: 'admin@example.com', password: 'short' }).expect(400);
      const response = await mutate('post', '/api/auth/setup').send({ code: store.setupToken(), email: 'admin@example.com', password }).expect(201);
      csrf = response.body.csrf;
      assert.ok(response.headers['set-cookie'][0].includes('HttpOnly'));
      assert.ok(response.headers['set-cookie'][0].includes('SameSite=Strict'));
      assert.equal(store.setupToken(), '');
      await mutate('post', '/api/auth/setup').send({}).expect(409);
      assert.notEqual(store.db.prepare('SELECT hash FROM users').get().hash, password);
    });
    await t.test('bloqueia CSRF e origens externas', async () => {
      await agent.put('/api/admin/settings').set('X-FC-Request', '1').send({}).expect(403);
      await mutate('put', '/api/admin/settings').set('Origin', 'https://attacker.example').send({}).expect(403);
    });
    let product, media;
    await t.test('valida e otimiza upload, rejeita conteúdo não raster', async () => {
      await mutate('post', '/api/admin/media').attach('image', Buffer.from('<svg/>'), 'fake.jpg').expect(400);
      const png = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#882233' } }).png().toBuffer();
      const response = await mutate('post', '/api/admin/media').attach('image', png, 'Minha foto.png').expect(201);
      media = response.body; assert.ok(media.url.endsWith('.webp'));
      assert.equal(media.width, 40);
      await request(app).get(media.url).expect('Content-Type', /image\/webp/).expect(200);
    });
    await t.test('rascunhos são privados; publicar e editar altera o site', async () => {
      const data = { name: 'Batom teste', description: 'Acabamento cremoso', category: 'Lábios', priceCents: 4590, image: media.url, imageAlt: 'Batom', published: false, order: 0 };
      await mutate('post', '/api/admin/entries/products').send({ ...data, priceCents: -1 }).expect(400);
      await mutate('post', '/api/admin/entries/products').send({ ...data, image: '/uploads/nonexistent.webp' }).expect(400);
      const response = await mutate('post', '/api/admin/entries/products').send(data).expect(201); product = response.body;
      assert.equal((await request(app).get('/api/site')).body.products.length, 0);
      const edited = await mutate('put', `/api/admin/entries/products/${product.id}`).send({ ...product, published: true }).expect(200);
      product = edited.body;
      const site = await request(app).get('/api/site');
      assert.equal(site.body.products[0].name, 'Batom teste');
      assert.equal(site.body.products[0].priceCents, 4590);
      assert.equal(site.body.products[0].revision, undefined);
      await mutate('delete', `/api/admin/media/${media.id}`).expect(409);
    });
    await t.test('edição concorrente é rejeitada; configurações e catálogo podem ser ocultados', async () => {
      await mutate('put', `/api/admin/entries/products/${product.id}`).send({ ...product, revision: 1 }).expect(409);
      const settings = (await agent.get('/api/admin/content')).body.settings;
      const edited = await mutate('put', '/api/admin/settings').send({ ...settings, heroTitle: 'Sua nova assinatura', whatsapp: '5544999999999', catalogEnabled: false }).expect(200);
      await mutate('put', '/api/admin/settings').send(settings).expect(409);
      const site = await request(app).get('/api/site');
      assert.equal(site.body.settings.heroTitle, 'Sua nova assinatura');
      assert.equal(site.body.products.length, 0);
      await mutate('put', '/api/admin/settings').send({ ...edited.body, catalogEnabled: true }).expect(200);
    });
    await t.test('serviços e galeria suportam criação, edição e exclusão', async () => {
      for (const collection of ['gallery', 'services']) {
        const input = collection === 'gallery' ? { title: 'Novo look', image: media.url, imageAlt: 'Make', category: 'beauty', published: false, order: 5 } : { name: 'Novo serviço', title: 'Novo', eyebrow: 'Make', description: 'Descrição', image: media.url, imageAlt: 'Make', published: false, order: 5 };
        const created = (await mutate('post', `/api/admin/entries/${collection}`).send(input).expect(201)).body;
        const changed = (await mutate('put', `/api/admin/entries/${collection}/${created.id}`).send({ ...created, title: 'Editado' }).expect(200)).body;
        await mutate('delete', `/api/admin/entries/${collection}/${changed.id}`).send({ revision: changed.revision }).expect(200);
      }
    });
    await t.test('exportação não contém senhas nem sessões', async () => {
      const response = await agent.get('/api/admin/export').expect(200);
      assert.equal(response.body.products.length, 1);
      assert.equal(response.body.users, undefined); assert.equal(response.body.sessions, undefined);
      assert.ok(response.headers['content-disposition'].includes('attachment'));
    });
    await t.test('dados sobrevivem à reabertura do banco', async () => {
      store.db.close(); ({ app, store } = createApp({ dataDir: dir }));
      assert.equal(store.list('products')[0].name, 'Batom teste');
      assert.equal(store.settings().heroTitle, 'Sua nova assinatura');
      assert.equal(store.db.prepare('SELECT count(*) AS n FROM media').get().n, 1);
    });
    await t.test('troca de senha encerra sessões; logout revoga cookie', async () => {
      const newAgent = request.agent(app);
      await newAgent.post('/api/auth/login').set('X-FC-Request', '1').send({ email: 'admin@example.com', password: 'wrong' }).expect(401);
      const login = await newAgent.post('/api/auth/login').set('X-FC-Request', '1').send({ email: 'admin@example.com', password }).expect(200);
      const current = login.body.csrf;
      const changed = await newAgent.post('/api/auth/password').set('X-FC-Request', '1').set('X-CSRF-Token', current).send({ currentPassword: password, password: 'Changed-password-12345' }).expect(200);
      await newAgent.post('/api/auth/logout').set('X-FC-Request', '1').set('X-CSRF-Token', changed.body.csrf).expect(200);
      await newAgent.get('/api/admin/content').expect(401);
      await request(app).post('/api/auth/login').set('X-FC-Request', '1').send({ email: 'admin@example.com', password }).expect(401);
    });
    await t.test('excluir produto libera sua imagem para remoção', async () => {
      const finalAgent = request.agent(app);
      const login = await finalAgent.post('/api/auth/login').set('X-FC-Request', '1').send({ email: 'admin@example.com', password: 'Changed-password-12345' }).expect(200);
      for (const [url, body] of [[`/api/admin/entries/products/${product.id}`, { revision: product.revision }], [`/api/admin/media/${media.id}`, {}]]) {
        await finalAgent.delete(url).set('X-FC-Request', '1').set('X-CSRF-Token', login.body.csrf).send(body).expect(200);
      }
      await request(app).get(media.url).expect(404);
    });
  } finally { store.db.close(); await rm(dir, { recursive: true, force: true }); }
});
