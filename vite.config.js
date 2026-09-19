import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  const base = pages ? '/fatimamakeup/' : '/';
  return {
    base,
    server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], watch: { ignored: ['**/.data/**'] }, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/server/**', '**/scripts/**', '**/tests/**'] } },
    preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
    build: {
      rollupOptions: { input: pages ? { site: resolve('index.html') } : { site: resolve('index.html'), admin: resolve('admin/index.html') } },
    },
    plugins: pages ? [{
      name: 'github-pages-static-info',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
        this.emitFile({ type: 'asset', fileName: 'admin/index.html', source: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#121211"><title>Painel administrativo · Fátima Correa makeup</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:#121211;color:#eae5dc;font-family:system-ui,sans-serif;display:grid;place-items:center;padding:28px}main{max-width:580px;border:1px solid #494039;padding:clamp(25px,5vw,55px)}small{letter-spacing:2px;color:#c5aa98;font-size:10px}h1{font:normal clamp(34px,6vw,48px)/1.1 Georgia,serif;margin:26px 0}p{color:#b3afa5;font-size:14px;line-height:1.9}a{display:inline-block;color:#121211;background:#eae5dc;padding:16px 22px;margin-top:18px;text-decoration:none;font-size:13px}a:focus-visible{outline:3px solid #c5919c;outline-offset:5px}</style></head><body><main><small>FÁTIMA CORREA MAKEUP</small><h1>Esta é a versão<br>vitrine do site.</h1><p>O site está publicado no GitHub Pages. Essa hospedagem exibe a vitrine, mas não executa o servidor e o banco de dados necessários para o painel administrativo.</p><p>O painel está preservado no projeto e poderá ser ativado em uma hospedagem compatível. Não há login administrativo nesta versão e nenhuma senha deve ser informada aqui.</p><a href="${base}">← Voltar ao site</a></main></body></html>` });
      },
    }] : [],
  };
});
