import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';

const app = document.querySelector('#app');
const dialog = document.querySelector('#editor');
let user = null, content = null, view = 'overview', query = '', dirty = false, modalDirty = false;
const names = { overview: 'Visão geral', products: 'Produtos', services: 'Serviços', gallery: 'Galeria', media: 'Biblioteca de imagens', website: 'Conteúdo do site', account: 'Minha conta' };
const icons = { overview: '◫', products: '◇', services: '✳', gallery: '▧', media: '▦', website: '≋', account: '◎' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = cents => cents === null ? 'Sob consulta' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toast = message => { const element = document.querySelector('#toast'); element.textContent = message; element.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => element.hidden = true, 5500); };
async function api(path, options = {}) {
  const headers = { 'X-FC-Request': '1', ...(user ? { 'X-CSRF-Token': user.csrf } : {}) };
  if (options.body && !(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.body); }
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
  if (!response.ok) {
    if (response.status === 401 && user) { user = null; dialog.close(); await initialize(); }
    throw new Error(data.details ? `${data.error} ${data.details.join(' ')}` : data.error || 'Não foi possível concluir.');
  }
  return data;
}
async function reload() { content = await api('/admin/content'); }
function field(label, name, value = '', options = {}) {
  const { type = 'text', required = false, max = 200, help = '', min = '', maxNumber = '', step = '', rows = 4 } = options;
  const attributes = `name="${name}" id="field-${name}" ${required ? 'required' : ''} maxlength="${max}" ${min !== '' ? `min="${min}"` : ''} ${maxNumber !== '' ? `max="${maxNumber}"` : ''} ${step ? `step="${step}"` : ''}`;
  return `<label class="field" for="field-${name}">${label}${type === 'textarea' ? `<textarea ${attributes} rows="${rows}">${esc(value)}</textarea>` : `<input ${attributes} type="${type}" value="${esc(value)}" ${type === 'password' ? 'autocomplete="new-password"' : ''}>`}${help ? `<small>${help}</small>` : ''}</label>`;
}
function checkbox(label, name, checked) { return `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`; }
function imagePicker(name, selected, optional = false) {
  return `<div class="image-picker" data-picker="${name}"><label class="field">Imagem<select name="${name}" ${optional ? '' : 'required'}><option value="">${optional ? 'Sem imagem' : 'Selecione uma imagem'}</option>${content.media.map(item => `<option value="${esc(item.url)}" ${item.url === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><div class="picker-preview">${selected ? `<img src="${esc(selected)}" alt="Prévia da imagem selecionada">` : '<span>Sem imagem selecionada</span>'}</div><label class="upload-button secondary">↑ Enviar nova imagem<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-picker="${name}"></label><small>JPG, PNG ou WebP · até 10 MB. A foto é otimizada automaticamente.</small></div>`;
}
function bindPickers(root) {
  root.querySelectorAll('[data-picker] select').forEach(select => select.addEventListener('change', () => {
    const preview = select.closest('.image-picker').querySelector('.picker-preview');
    preview.innerHTML = select.value ? `<img src="${esc(select.value)}" alt="Prévia da imagem selecionada">` : '<span>Sem imagem selecionada</span>';
  }));
  root.querySelectorAll('[data-upload-picker]').forEach(input => input.addEventListener('change', async () => {
    if (!input.files[0]) return;
    input.disabled = true;
    const label = input.closest('label'); label.classList.add('busy');
    try {
      const media = await upload(input.files[0]);
      const select = input.closest('.image-picker').querySelector('select');
      root.querySelectorAll('[data-picker] select').forEach(other => other.add(new Option(media.name, media.url, false, other === select)));
      select.value = media.url;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      if (root.closest('dialog')) modalDirty = true; else dirty = true;
      toast('Imagem enviada. Salve a edição para publicá-la no site.');
    } catch (error) { toast(error.message); }
    finally { input.disabled = false; label.classList.remove('busy'); input.value = ''; }
  }));
}
async function upload(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter até 10 MB.');
  const body = new FormData(); body.append('image', file);
  const media = await api('/admin/media', { method: 'POST', body });
  content.media.unshift(media); return media;
}
function errorIn(form, error) { const box = form.querySelector('.form-error'); box.textContent = error.message; box.hidden = false; box.focus(); }
const errorBox = '<p class="form-error" role="alert" tabindex="-1" hidden></p>';
async function initialize() {
  try {
    const data = await api('/auth/session');
    if (data.user) { user = data.user; await reload(); render(); }
    else renderLogin(data.setupRequired);
  } catch { app.innerHTML = '<main class="connection-error"><h1>Não foi possível conectar.</h1><p>Confira se o servidor está ativo e tente novamente.</p><button onclick="location.reload()">Tentar novamente</button><a href="/">Voltar ao site</a></main>'; }
}
function renderLogin(setup) {
  app.innerHTML = `<main class="auth-layout"><section class="auth-editorial"><a href="/" class="brand">Fátima Correa<span>MAKEUP</span></a><div><span class="eyebrow">SEU ATELIÊ DIGITAL</span><h1>A sua beleza.<br/>O seu <em>controle.</em></h1><p>Seu catálogo, suas imagens e sua marca.<br/>Tudo em um só lugar.</p></div><span class="auth-foot">FEITO PARA QUEM CUIDA DE CADA DETALHE.</span></section><section class="auth-form-wrap"><a class="back-link" href="/">↗ Voltar ao site</a><form id="auth-form"><span class="eyebrow">ÁREA EXCLUSIVA</span><h2>${setup ? 'Vamos começar.' : 'Bem-vinda de volta.'}</h2><p class="muted">${setup ? 'Crie o acesso da administradora. A senha é definida por você e não deve ser compartilhada.' : 'Entre para cuidar do seu site.'}</p>${setup ? `<div class="notice">Para proteger o primeiro acesso, obtenha o código de ativação no terminal do servidor com <code>npm run admin:setup</code>. Ele funciona uma única vez.</div>${field('Código de ativação', 'code', '', { required: true, max: 64 })}` : ''}${field('E-mail', 'email', '', { type: 'email', required: true, max: 180 })}${field('Senha', 'password', '', { type: 'password', required: true, max: 128, help: setup ? 'No mínimo 12 caracteres. Use uma senha única.' : '' })}${setup ? field('Confirmar senha', 'confirm', '', { type: 'password', required: true, max: 128 }) : ''}${errorBox}<button class="primary" type="submit">${setup ? 'Criar meu acesso' : 'Entrar no painel'} <span>↗</span></button><p class="security-note">Acesso protegido · Sessão de até 8 horas</p></form></section></main>`;
  const form = app.querySelector('form');
  form.elements.password.autocomplete = setup ? 'new-password' : 'current-password';
  if (setup) form.elements.password.minLength = 12;
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      if (setup && data.password !== data.confirm) throw new Error('As senhas não coincidem.');
      user = await api(setup ? '/auth/setup' : '/auth/login', { method: 'POST', body: data });
      await reload(); render();
    } catch (error) { errorIn(form, error); } finally { button.disabled = false; }
  });
}
function render() {
  app.innerHTML = `<div class="admin-layout"><aside class="sidebar"><a class="brand" href="/" target="_blank" rel="noopener">Fátima Correa<span>MAKEUP / ADMIN</span></a><span class="sidebar-label">SEU ATELIÊ DIGITAL</span><nav aria-label="Administração">${Object.entries(names).map(([key, name]) => `<button data-view="${key}" class="nav-item ${view === key ? 'active' : ''}" ${view === key ? 'aria-current="page"' : ''}><span>${icons[key]}</span>${name}</button>`).join('')}</nav><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">Visualizar site ↗</a><button id="logout">Sair da conta ↗</button></div></aside><div class="workspace"><header class="topbar"><div><span class="eyebrow">PAINEL DE CONTROLE</span><span class="topbar-section">${names[view]}</span></div><div class="user-mark"><span>FC</span><p>${esc(user.email)}</p><button id="logout-top" class="logout-top">Sair</button></div></header><main class="main-content" id="admin-main"><div class="page-heading"><div><span class="eyebrow">FÁTIMA CORREA MAKEUP</span><h1>${names[view]}<span>.</span></h1></div>${['products', 'services', 'gallery'].includes(view) ? `<button class="primary" id="add-entry">+ ${view === 'products' ? 'Novo produto' : view === 'services' ? 'Novo serviço' : 'Nova inspiração'}</button>` : ''}</div><div id="view-content"></div></main><footer class="admin-footer">Seu negócio, com a sua assinatura. <span>F / C</span></footer></div></div>`;
  app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
  app.querySelectorAll('#logout, #logout-top').forEach(button => button.addEventListener('click', async () => {
    if (dirty && !confirm('Sair sem salvar as alterações?')) return;
    try { await api('/auth/logout', { method: 'POST' }); user = null; dirty = false; renderLogin(false); } catch (error) { toast(error.message); }
  }));
  const container = app.querySelector('#view-content');
  if (view === 'overview') renderOverview(container);
  else if (['products', 'services', 'gallery'].includes(view)) renderEntries(container);
  else if (view === 'media') renderMedia(container);
  else if (view === 'website') renderSettings(container);
  else renderAccount(container);
}
async function navigate(next) {
  if (dirty && !confirm('Você tem alterações não salvas. Deseja descartá-las?')) return;
  try { await reload(); dirty = false; query = ''; view = next; render(); window.scrollTo(0, 0); } catch (error) { toast(error.message); }
}
function renderOverview(container) {
  const published = content.products.filter(item => item.published).length;
  container.innerHTML = `<section class="welcome"><div><span class="eyebrow">CADA DETALHE CONTA.</span><h2>O próximo capítulo<br/>da sua <em>marca.</em></h2><p>Atualize a vitrine, escolha novas imagens e mantenha<br/>o site tão autêntico quanto o seu trabalho.</p><button class="light" data-go="website">Personalizar meu site ↗</button></div><div class="welcome-monogram" aria-hidden="true">F<span>/</span>C</div></section><div class="stats">${[[content.products.length, 'Produtos no catálogo', `${published} publicados`, 'products'], [content.gallery.length, 'Inspirações', 'Sua seleção de beleza', 'gallery'], [content.media.filter(item => !item.builtin).length, 'Imagens enviadas', 'Biblioteca da marca', 'media']].map(([total, title, sub, destination]) => `<button class="stat" data-go="${destination}"><span>${title} <b>↗</b></span><strong>${total.toString().padStart(2, '0')}</strong><small>${sub}</small></button>`).join('')}</div><section class="panel"><div class="panel-heading"><h2>Prepare sua vitrine</h2><span>PRÓXIMOS PASSOS</span></div><div class="checklist">${[[content.media.some(item => !item.builtin), 'Adicione suas próprias fotos', 'Substitua as imagens ilustrativas pelo seu trabalho.', 'media'], [!!content.settings.whatsapp, 'Conecte seu WhatsApp', 'Receba consultas sobre serviços e produtos.', 'website'], [published > 0, 'Publique seu primeiro produto', 'O catálogo aparece no site quando há produtos publicados.', 'products']].map(([done, title, description, destination]) => `<button data-go="${destination}"><span class="task-icon ${done ? 'done' : ''}">${done ? '✓' : '○'}</span><span><strong>${title}</strong><small>${description}</small></span><b>↗</b></button>`).join('')}</div></section><div class="notice">As alterações salvas ficam disponíveis no site público. Produtos e inspirações em rascunho aparecem apenas aqui. O catálogo é uma vitrine, sem carrinho ou pagamento online.</div>`;
  container.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
}
function renderEntries(container) {
  container.innerHTML = `<div class="toolbar"><label class="search"><span>⌕</span><input type="search" placeholder="Buscar ${names[view].toLowerCase()}…" aria-label="Buscar itens" value="${esc(query)}"></label><span class="muted">${content[view].length} ${content[view].length === 1 ? 'item' : 'itens'} · ordenados pela posição</span></div><div id="entry-list"></div>`;
  app.querySelector('#add-entry').addEventListener('click', () => openEditor(view));
  container.querySelector('input').addEventListener('input', event => { query = event.target.value; renderList(); });
  function renderList() {
    const items = content[view].filter(item => `${item.name || item.title} ${item.category || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    const list = container.querySelector('#entry-list');
    if (!items.length) { list.innerHTML = `<div class="empty-state"><span>◇</span><h2>${query ? 'Nenhum resultado.' : 'Sua próxima seleção começa aqui.'}</h2><p>${query ? 'Tente outro nome ou categoria.' : 'Adicione o primeiro item. Você pode salvá-lo como rascunho antes de publicar.'}</p>${query ? '' : '<button class="primary" id="empty-add">Adicionar primeiro item +</button>'}</div>`; list.querySelector('#empty-add')?.addEventListener('click', () => openEditor(view)); return; }
    list.innerHTML = `<div class="entry-grid">${items.map(item => `<article class="entry-card"><div class="entry-image">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.imageAlt)}" loading="lazy">` : '<span>Sem imagem</span>'}<span class="badge ${item.published ? 'published' : ''}">${item.published ? 'Publicado' : 'Rascunho'}</span></div><div class="entry-info"><span class="eyebrow">${esc(item.category || (view === 'services' ? 'SERVIÇO' : 'CATÁLOGO'))} · POS. ${item.order}</span><h3>${esc(item.name || item.title)}</h3><p>${view === 'products' ? money(item.priceCents) : esc(item.description || item.imageAlt)}</p><div class="entry-actions"><button class="secondary" data-edit="${item.id}">Editar ↗</button><button class="delete-text" data-delete="${item.id}" aria-label="Excluir ${esc(item.name || item.title)}">Excluir</button></div></div></article>`).join('')}</div>`;
    list.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditor(view, content[view].find(item => item.id === button.dataset.edit))));
    list.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
      const item = content[view].find(item => item.id === button.dataset.delete);
      if (!confirm(`Excluir “${item.name || item.title}”? Esta ação remove o item do site e não pode ser desfeita.`)) return;
      button.disabled = true;
      try { await api(`/admin/entries/${view}/${item.id}`, { method: 'DELETE', body: { revision: item.revision } }); await reload(); render(); toast('Item excluído.'); } catch (error) { toast(error.message); button.disabled = false; }
    }));
  }
  renderList();
}
function openEditor(collection, item = {}) {
  const isProduct = collection === 'products', isService = collection === 'services';
  const label = isProduct ? 'produto' : isService ? 'serviço' : 'inspiração';
  document.querySelector('#editor-content').innerHTML = `<div class="eyebrow">SUA CURADORIA</div><h2>${item.id ? 'Editar' : 'Adicionar'} ${label}</h2><form id="entry-form">${isProduct || isService ? field('Nome', 'name', item.name, { required: true, max: isProduct ? 120 : 80 }) : ''}${!isProduct ? field('Título exibido no site', 'title', item.title, { required: true, max: isService ? 60 : 100 }) : ''}${isService ? field('Frase curta acima do título', 'eyebrow', item.eyebrow, { max: 80 }) : ''}${isProduct || isService ? field('Descrição', 'description', item.description, { type: 'textarea', required: isService, max: isProduct ? 2000 : 500 }) : ''}${isProduct ? `<div class="form-columns">${field('Categoria', 'category', item.category, { max: 80 })}${field('Preço (R$)', 'price', item.priceCents == null ? '' : (item.priceCents / 100).toFixed(2), { type: 'number', min: 0, maxNumber: 1000000, step: '.01', help: 'Deixe vazio para “Sob consulta”.' })}</div>` : !isService ? `<label class="field">Categoria<select name="category"><option value="social" ${item.category === 'social' ? 'selected' : ''}>Social</option><option value="bridal" ${item.category === 'bridal' ? 'selected' : ''}>Noivas</option><option value="beauty" ${item.category === 'beauty' ? 'selected' : ''}>Glam</option></select></label>` : ''}${imagePicker('image', item.image, isProduct)}${field('Descrição da imagem (acessibilidade)', 'imageAlt', item.imageAlt, { required: !isProduct, max: 200, help: 'Descreva o que aparece na foto para leitores de tela.' })}${field('Posição na lista', 'order', item.order ?? content[collection].length, { type: 'number', required: true, min: 0, maxNumber: 9999, help: 'Números menores aparecem primeiro.' })}${checkbox('Publicar no site', 'published', item.published || false)}<p class="muted small">Desmarque para manter o item em rascunho, visível apenas no painel.</p>${errorBox}<div class="form-actions"><button type="button" class="secondary" id="cancel-edit">Cancelar</button><button class="primary" type="submit">Salvar ${label} ↗</button></div></form>`;
  modalDirty = false; dialog.showModal(); document.body.style.overflow = 'hidden';
  const form = dialog.querySelector('form'); bindPickers(form);
  form.addEventListener('input', () => modalDirty = true);
  form.addEventListener('change', () => modalDirty = true);
  dialog.querySelector('#cancel-edit').addEventListener('click', closeEditor);
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      if (form.querySelector('input[type=file]:disabled')) throw new Error('Aguarde o envio da imagem terminar.');
      const data = Object.fromEntries(new FormData(form));
      data.published = form.elements.published.checked; data.order = Number(data.order);
      if (isProduct) { data.priceCents = data.price === '' ? null : Math.round(Number(data.price) * 100); delete data.price; data.image = data.image || null; }
      if (item.id) data.revision = item.revision;
      await api(`/admin/entries/${collection}${item.id ? `/${item.id}` : ''}`, { method: item.id ? 'PUT' : 'POST', body: data });
      modalDirty = false; dialog.close(); await reload(); render(); toast('Alterações salvas. O site já foi atualizado.');
    } catch (error) { errorIn(form, error); } finally { button.disabled = false; }
  });
}
function closeEditor() { if (modalDirty && !confirm('Descartar as alterações não salvas?')) return; modalDirty = false; dialog.close(); }
dialog.querySelector('.dialog-close').addEventListener('click', closeEditor);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
dialog.addEventListener('close', () => document.body.style.overflow = '');
function renderMedia(container) {
  container.innerHTML = `<div class="upload-zone"><span>↑</span><h2>O seu trabalho merece ser visto.</h2><p>Envie suas fotos para usá-las na capa, no catálogo e na galeria.</p><label class="upload-button primary">Selecionar imagens<input id="media-upload" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><small>JPG, PNG ou WebP · até 10 MB por imagem · limite total de 500 MB</small><p id="upload-status" role="status"></p></div><div class="panel-heading"><h2>Sua biblioteca <span class="muted">(${content.media.length})</span></h2><span>ARQUIVOS OTIMIZADOS</span></div><div class="media-grid">${content.media.map(item => `<article class="media-card"><img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><div><strong>${esc(item.name)}</strong><small>${item.width} × ${item.height}${item.bytes ? ` · ${(item.bytes / 1024).toFixed(0)} KB` : ''}</small>${item.builtin ? '<span class="builtin-label">Ilustrativa · arquivo do modelo</span>' : `<button data-delete-media="${item.id}" class="delete-text">Excluir imagem</button>`}</div></article>`).join('')}</div><p class="muted small">Imagens em uso não podem ser excluídas. Os arquivos ilustrativos do modelo são protegidos; substitua-os nos editores quando desejar.</p>`;
  const input = container.querySelector('#media-upload');
  input.addEventListener('change', async () => {
    const files = [...input.files]; if (!files.length) return; input.disabled = true;
    let count = 0; const errors = [];
    for (const file of files) {
      container.querySelector('#upload-status').textContent = `Enviando ${count + errors.length + 1} de ${files.length}…`;
      try { await upload(file); count++; } catch (error) { errors.push(`${file.name}: ${error.message}`); }
    }
    renderMedia(container); toast(`${count} imagem(ns) enviada(s).`);
    if (errors.length) { const box = container.querySelector('#upload-status'); box.textContent = errors.join('\n'); box.className = 'form-error'; }
  });
  container.querySelectorAll('[data-delete-media]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Excluir permanentemente esta imagem da biblioteca?')) return;
    button.disabled = true;
    try { await api(`/admin/media/${button.dataset.deleteMedia}`, { method: 'DELETE' }); await reload(); renderMedia(container); toast('Imagem excluída.'); } catch (error) { toast(error.message); button.disabled = false; }
  }));
}
function renderSettings(container) {
  const s = content.settings;
  container.innerHTML = `<p class="page-description">Personalize o conteúdo principal. Tudo que você salvar será refletido no site público.</p><form id="settings-form"><section class="panel"><div class="panel-heading"><h2>01 / Primeira impressão</h2><span>CAPA DO SITE</span></div><div class="form-columns"><div>${field('Título principal', 'heroTitle', s.heroTitle, { required: true, max: 80 })}${field('Destaque em itálico', 'heroAccent', s.heroAccent, { required: true, max: 60 })}${field('Texto de apresentação', 'heroDescription', s.heroDescription, { type: 'textarea', required: true, max: 300 })}</div><div>${imagePicker('heroImage', s.heroImage)}${field('Descrição da foto principal', 'heroImageAlt', s.heroImageAlt, { required: true, max: 200 })}${field('Enquadramento horizontal (%)', 'heroPosition', s.heroPosition, { type: 'number', min: 0, maxNumber: 100, required: true, help: '0 = esquerda · 50 = centro · 100 = direita.' })}</div></div></section><section class="panel"><div class="panel-heading"><h2>02 / Sua assinatura</h2><span>SOBRE A PROFISSIONAL</span></div><div class="form-columns"><div>${field('Título', 'aboutTitle', s.aboutTitle, { required: true, max: 80 })}${field('Destaque em itálico', 'aboutAccent', s.aboutAccent, { required: true, max: 80 })}${field('Apresentação', 'aboutText', s.aboutText, { type: 'textarea', required: true, max: 1800 })}${field('Segundo parágrafo', 'aboutText2', s.aboutText2, { type: 'textarea', max: 1800 })}</div><div>${imagePicker('aboutImage', s.aboutImage)}${field('Descrição da imagem', 'aboutImageAlt', s.aboutImageAlt, { required: true, max: 200 })}${field('Legenda sobre a foto', 'aboutCaption', s.aboutCaption, { max: 140 })}</div></div></section><section class="panel"><div class="panel-heading"><h2>03 / Vamos conversar</h2><span>CONTATOS</span></div><div class="form-columns">${field('WhatsApp', 'whatsapp', s.whatsapp, { max: 15, help: 'País + DDD + número, somente dígitos. Ex.: 5544999999999. Vazio desativa os links diretos.' })}${field('Instagram', 'instagram', s.instagram, { max: 30, help: 'Somente o nome de usuário, sem @.' })}</div>${field('Cidade de atendimento', 'city', s.city, { max: 120 })}</section><section class="panel"><div class="panel-heading"><h2>04 / Sua seleção</h2><span>CATÁLOGO E GALERIA</span></div>${checkbox('Exibir catálogo quando houver produtos publicados', 'catalogEnabled', s.catalogEnabled)}${field('Título do catálogo', 'catalogTitle', s.catalogTitle, { required: true, max: 80 })}${field('Apresentação do catálogo', 'catalogDescription', s.catalogDescription, { type: 'textarea', max: 500 })}${field('Nota abaixo da galeria', 'galleryNote', s.galleryNote, { type: 'textarea', max: 500, help: 'Atualize esta nota ao substituir as imagens ilustrativas.' })}</section><section class="panel"><div class="panel-heading"><h2>05 / Encontrar sua marca</h2><span>TÍTULO E DESCRIÇÃO</span></div>${field('Título da página', 'seoTitle', s.seoTitle, { required: true, max: 100 })}${field('Descrição para buscas', 'seoDescription', s.seoDescription, { type: 'textarea', required: true, max: 300 })}</section><div class="save-bar"><span id="save-state">As alterações ainda não salvas não aparecem no site.</span><button class="primary" type="submit">Salvar alterações ↗</button></div>${errorBox}</form>`;
  const form = container.querySelector('form'); bindPickers(form);
  form.addEventListener('input', () => { dirty = true; container.querySelector('#save-state').textContent = 'Você tem alterações não salvas.'; });
  form.addEventListener('change', () => dirty = true);
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      if (form.querySelector('input[type=file]:disabled')) throw new Error('Aguarde o envio da imagem terminar.');
      const data = Object.fromEntries(new FormData(form)); data.heroPosition = Number(data.heroPosition); data.catalogEnabled = form.elements.catalogEnabled.checked; data.revision = content.settings.revision;
      content.settings = await api('/admin/settings', { method: 'PUT', body: data });
      dirty = false; container.querySelector('#save-state').textContent = 'Alterações salvas e publicadas.'; form.querySelector('.form-error').hidden = true; toast('Site atualizado com sucesso.');
    } catch (error) { errorIn(form, error); } finally { button.disabled = false; }
  });
}
function renderAccount(container) {
  container.innerHTML = `<div class="account-grid"><section class="panel"><div class="panel-heading"><h2>Segurança</h2><span>ACESSO PESSOAL</span></div><p class="muted">Conectada como <strong>${esc(user.email)}</strong></p><form id="password-form">${field('Senha atual', 'currentPassword', '', { type: 'password', required: true, max: 128 })}${field('Nova senha', 'password', '', { type: 'password', required: true, max: 128, help: 'Pelo menos 12 caracteres. As outras sessões serão encerradas.' })}${field('Confirmar nova senha', 'confirm', '', { type: 'password', required: true, max: 128 })}${errorBox}<button class="primary" type="submit">Atualizar senha ↗</button></form></section><section class="panel export-panel"><span class="export-icon">↓</span><h2>Seu conteúdo é seu.</h2><p>Exporte textos, produtos, serviços e referências das imagens em um arquivo JSON.</p><a class="secondary" href="/api/admin/export" download>Exportar conteúdo ↓</a><div class="notice">Esta exportação não inclui os arquivos das fotos nem credenciais. Para um backup completo, copie a pasta de dados do servidor, conforme o README.</div></section></div>`;
  const form = container.querySelector('form'); form.elements.currentPassword.autocomplete = 'current-password'; form.elements.password.minLength = 12;
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form)); if (data.password !== data.confirm) throw new Error('As senhas não coincidem.');
      user = await api('/auth/password', { method: 'POST', body: data }); form.reset(); form.querySelector('.form-error').hidden = true; toast('Senha atualizada. Outras sessões foram encerradas.');
    } catch (error) { errorIn(form, error); } finally { button.disabled = false; }
  });
}
window.addEventListener('beforeunload', event => { if (dirty || modalDirty) { event.preventDefault(); event.returnValue = ''; } });
initialize();
