const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = value => value === null ? 'Sob consulta' : (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let settings = null;
export const getSiteSettings = () => settings;
function text(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
function photo(selector, src, alt) { const image = document.querySelector(selector); if (image) { image.src = src; image.alt = alt; } }
export async function loadSite() {
  try {
    const response = await fetch('/api/site');
    if (!response.ok) throw new Error('Site indisponível');
    const data = await response.json(); settings = data.settings;
    const s = settings;
    document.title = s.seoTitle;
    document.querySelector('meta[name=description]').content = s.seoDescription;
    const heading = document.querySelector('.hero h1');
    heading.replaceChildren(document.createTextNode(s.heroTitle + ' '));
    const accent = document.createElement('em'); accent.textContent = s.heroAccent; heading.append(accent);
    text('.hero-description p', s.heroDescription);
    photo('.hero-photo', s.heroImage, s.heroImageAlt);
    document.querySelector('.hero-photo').style.objectPosition = `${s.heroPosition}% center`;
    const aboutHeading = document.querySelector('.about-copy h2');
    aboutHeading.replaceChildren(document.createTextNode(s.aboutTitle), document.createElement('br'));
    const aboutAccent = document.createElement('em'); aboutAccent.textContent = s.aboutAccent; aboutHeading.append(aboutAccent);
    const paragraphs = document.querySelectorAll('.about-copy p'); paragraphs[0].textContent = s.aboutText; paragraphs[1].textContent = s.aboutText2;
    photo('.about-visual img', s.aboutImage, s.aboutImageAlt);
    text('.photo-caption', s.aboutCaption); document.querySelector('.photo-caption').hidden = !s.aboutCaption;
    text('.image-note', s.galleryNote);
    document.querySelector('.service-grid').innerHTML = data.services.map((item, index) => `<button class="service-card" data-book data-service="${escape(item.name)}"><img src="${escape(item.image)}" alt="${escape(item.imageAlt)}" loading="lazy"><span class="card-number">${String(index + 1).padStart(2, '0')} /</span><span class="service-copy"><span class="mini">${escape(item.eyebrow)}</span><strong>${escape(item.title)}</strong><span class="card-description">${escape(item.description)}</span></span><span class="circle-arrow">↗</span></button>`).join('');
    document.querySelector('#servicos').hidden = data.services.length === 0;
    document.querySelector('#booking-form select').innerHTML = (data.services.length ? data.services.map(item => item.name) : ['Consulta personalizada']).map(name => `<option>${escape(name)}</option>`).join('');
    document.querySelector('.gallery').innerHTML = data.gallery.map(item => `<button class="gallery-item" data-category="${item.category}" data-image="${escape(item.image)}" data-title="${escape(item.title)}" data-alt="${escape(item.imageAlt)}"><img src="${escape(item.image)}" alt="${escape(item.imageAlt)}" loading="lazy"><span>${escape(item.title)} <b>↗</b></span></button>`).join('');
    document.querySelector('#inspiracoes').hidden = data.gallery.length === 0;
    document.querySelectorAll('[data-filter]').forEach(button => { if (button.dataset.filter !== 'all') button.hidden = !data.gallery.some(item => item.category === button.dataset.filter); });
    const contacts = document.querySelector('#public-contacts');
    contacts.innerHTML = `${s.city ? `<span>${escape(s.city)}</span>` : ''}${s.instagram ? `<a href="https://www.instagram.com/${encodeURIComponent(s.instagram)}/" target="_blank" rel="noopener noreferrer">Instagram ↗</a>` : ''}${s.whatsapp ? `<a href="https://wa.me/${s.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>` : ''}`;
    if (s.whatsapp) {
      text('.demo-note', 'Prepare sua solicitação e envie pelo WhatsApp. A data será confirmada pessoalmente após a consulta de disponibilidade.');
      text('.faq-list details:first-child p', 'Informe a ocasião e a data desejada no botão de agendamento. Você poderá revisar sua mensagem e enviá-la diretamente pelo WhatsApp da Fátima.');
      text('.faq-list details:last-child p', 'Você pode enviar sua solicitação pelo WhatsApp. A reserva só será confirmada após combinar disponibilidade e detalhes com a profissional.');
    }
    renderCatalog(data.products);
  } catch (error) {
    // The editorial content remains accessible if the API is unavailable.
    console.warn('Conteúdo dinâmico indisponível. Exibindo a versão editorial de referência.');
  }
}
function renderCatalog(products) {
  const section = document.querySelector('#catalogo');
  const enabled = settings.catalogEnabled && products.length > 0;
  section.hidden = !enabled;
  document.querySelector('[href="#catalogo"]').hidden = !enabled;
  if (!enabled) return;
  text('#catalog-title', settings.catalogTitle); text('#catalog-description', settings.catalogDescription);
  const filter = document.querySelector('#catalog-category');
  [...new Set(products.map(item => item.category).filter(Boolean))].sort().forEach(category => filter.add(new Option(category, category)));
  const search = document.querySelector('#catalog-search');
  const grid = document.querySelector('#catalog-grid');
  const dialog = document.querySelector('#product-dialog');
  function render() {
    const term = search.value.toLocaleLowerCase('pt-BR').trim();
    const items = products.filter(item => (!filter.value || filter.value === item.category) && `${item.name} ${item.category}`.toLocaleLowerCase('pt-BR').includes(term));
    grid.innerHTML = items.map(item => `<button class="product-card" data-product="${item.id}"><div class="product-photo">${item.image ? `<img src="${escape(item.image)}" alt="${escape(item.imageAlt || item.name)}" loading="lazy">` : '<span class="product-placeholder">F / C</span>'}<span class="product-open">↗</span></div><span class="product-category">${escape(item.category || 'SELEÇÃO FÁTIMA CORREA')}</span><strong>${escape(item.name)}</strong><span class="product-price">${money(item.priceCents)}</span></button>`).join('');
    document.querySelector('#catalog-empty').hidden = items.length > 0;
    grid.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => {
      const item = products.find(product => product.id === button.dataset.product);
      document.querySelector('#product-detail').innerHTML = `${item.image ? `<img class="product-detail-image" src="${escape(item.image)}" alt="${escape(item.imageAlt || item.name)}">` : ''}<div class="product-detail-copy"><div class="label">${escape(item.category || 'SELEÇÃO FÁTIMA CORREA')}</div><h2>${escape(item.name)}</h2><p class="product-detail-price">${money(item.priceCents)}</p><p class="product-detail-description">${escape(item.description)}</p>${settings.whatsapp ? `<a class="button light" href="https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Olá, Fátima! Gostaria de saber mais sobre o produto ${item.name}. Pode me informar a disponibilidade?`)}" target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp ↗</a><p class="small-note">Disponibilidade e condições confirmadas diretamente com a profissional.</p>` : '<p class="small-note">Contato para consultas em atualização. Volte em breve para consultar a disponibilidade.</p>'}</div>`;
      dialog.showModal(); document.body.style.overflow = 'hidden';
    }));
  }
  search.addEventListener('input', render); filter.addEventListener('change', render); render();
}
