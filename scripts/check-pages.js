import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve('dist');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const base = '/fatimamakeup/';
assert.ok(existsSync(join(root, '.nojekyll')), 'O build estático precisa de .nojekyll.');
assert.ok(!html.includes('src="/src/'), 'O HTML deve referenciar JavaScript compilado.');
const resources = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(path => path.startsWith(base));
assert.ok(resources.some(path => path.endsWith('.js')), 'Bundle JavaScript ausente.');
assert.ok(resources.some(path => path.endsWith('.css')), 'CSS compilado ausente.');
for (const path of resources) assert.ok(existsSync(join(root, path.slice(base.length))), `Recurso ausente: ${path}`);
for (const path of resources.filter(path => path.endsWith('.js'))) {
  assert.ok(!readFileSync(join(root, path.slice(base.length)), 'utf8').includes('/api/site'), 'A vitrine não deve depender da API.');
}
const admin = readFileSync(join(root, 'admin/index.html'), 'utf8');
assert.ok(admin.includes('versão'), 'A rota admin deve explicar a limitação.');
assert.ok(!/<(?:input|form|script)\b/i.test(admin), 'Não publicar login ou código administrativo na vitrine.');
assert.ok(!existsSync(join(root, '.data')), 'Dados privados não podem ser publicados.');
assert.ok(!existsSync(join(root, 'server')), 'O artefato Pages não deve conter o backend.');
console.log('Vitrine validada: imagens/CSS/JS presentes, base correta e painel apenas informativo.');
