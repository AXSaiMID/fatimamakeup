import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createStore } from '../server/store.js';

if (!process.argv.includes('--confirm')) {
  console.log('Este comando remove somente o acesso administrativo e encerra todas as sessões. O conteúdo e as imagens são preservados.');
  console.log('Uso pelo responsável pelo servidor: npm run admin:reset -- --confirm');
  process.exit(1);
}
const store = createStore();
store.db.exec('BEGIN; DELETE FROM sessions; DELETE FROM users; COMMIT;');
writeFileSync(store.tokenFile, randomBytes(24).toString('hex'), { mode: 0o600 });
store.db.close();
console.log('Acesso reiniciado. Execute npm run admin:setup para obter o novo código e criar a conta em /admin/.');
