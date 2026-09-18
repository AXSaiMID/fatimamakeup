import { createStore } from '../server/store.js';
const store = createStore();
if (store.db.prepare('SELECT id FROM users LIMIT 1').get()) {
  console.log('Já existe uma administradora. Acesse /admin/ com o e-mail e a senha cadastrados.');
} else {
  console.log('\nAbra /admin/ no site e crie seu acesso com este código de ativação de uso único:');
  console.log(store.setupToken());
  console.log('\nGuarde o código em segurança. Não o publique. Nenhuma senha padrão é criada.\n');
}
store.db.close();
