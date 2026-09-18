import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], watch: { ignored: ['**/.data/**'] }, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/server/**', '**/scripts/**', '**/tests/**'] } },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  build: { rollupOptions: { input: { site: resolve('index.html'), admin: resolve('admin/index.html') } } },
});
