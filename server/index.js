import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.js';

const { app, store } = createApp();
const production = process.env.NODE_ENV === 'production';
app.use((req, res, next) => {
  if (/^\/(?:\.data|server|scripts|tests|\.env|\.git)(?:[/.]|$)/.test(req.path)) return res.sendStatus(404);
  next();
});
app.use((req, res, next) => { if (req.path === '/admin') return res.redirect(302, '/admin/'); next(); });
if (production) {
  app.use(express.static(resolve('dist')));
  app.use((req, res) => res.status(404).send('Página não encontrada.'));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'mpa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5173);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Fátima Correa makeup · http://0.0.0.0:${port}`);
  console.log('Painel: /admin/');
  if (!store.db.prepare('SELECT id FROM users LIMIT 1').get()) console.log('Primeiro acesso: execute npm run admin:setup para obter o código de ativação.');
});
function shutdown() { server.close(() => { store.db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
