import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import { loadSite, getSiteSettings } from './site-content.js';

async function initializeSite() {
await loadSite();
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Abrir menu');
}));
const booking = document.querySelector('#booking-dialog');
const form = document.querySelector('#booking-form');
const result = document.querySelector('#booking-result');
const today = new Date();
form.elements.date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
function openBooking(service) {
  form.hidden = false;
  result.hidden = true;
  if (service && [...form.elements.service.options].some(option => option.value === service)) form.elements.service.value = service;
  booking.showModal();
  document.body.style.overflow = 'hidden';
}
document.querySelectorAll('[data-book]').forEach(button => button.addEventListener('click', () => openBooking(button.dataset.service)));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const date = new Date(`${data.get('date')}T12:00:00`).toLocaleDateString('pt-BR');
  document.querySelector('#message').value = `Olá, Fátima! Meu nome é ${data.get('name').trim()}. Gostaria de consultar disponibilidade para ${data.get('service').toLowerCase()} no dia ${date}.${data.get('notes').trim() ? `\n\nDetalhes: ${data.get('notes').trim()}` : ''}\n\nPode me informar os valores e horários disponíveis?`;
  const whatsapp = getSiteSettings()?.whatsapp;
  const send = document.querySelector('#send-whatsapp');
  send.hidden = !whatsapp;
  if (whatsapp) send.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(document.querySelector('#message').value)}`;
  form.hidden = true;
  result.hidden = false;
  document.querySelector('#copy-status').textContent = '';
  document.querySelector('#copy-message').focus();
});
document.querySelector('#edit-request').addEventListener('click', () => { form.hidden = false; result.hidden = true; form.elements.name.focus(); });
document.querySelector('#copy-message').addEventListener('click', async () => {
  const text = document.querySelector('#message');
  try {
    await navigator.clipboard.writeText(text.value);
    document.querySelector('#copy-status').textContent = 'Mensagem copiada! Nenhuma solicitação foi enviada.';
  } catch {
    text.focus(); text.select();
    document.querySelector('#copy-status').textContent = 'Selecione e copie o texto acima para salvar sua solicitação.';
  }
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(filter => {
    filter.classList.toggle('active', filter === button);
    filter.setAttribute('aria-pressed', String(filter === button));
  });
  document.querySelector('.gallery').classList.toggle('filtered', button.dataset.filter !== 'all');
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.hidden = button.dataset.filter !== 'all' && item.dataset.category !== button.dataset.filter;
  });
}));
const lightbox = document.querySelector('#image-dialog');
let selectedService;
document.querySelectorAll('.gallery-item').forEach(item => item.addEventListener('click', () => {
  const image = document.querySelector('#lightbox-image');
  image.src = item.dataset.image;
  image.alt = item.dataset.alt || item.dataset.title;
  document.querySelector('#lightbox-title').textContent = item.dataset.title;
  selectedService = { social: 'Maquiagem social', bridal: 'Maquiagem para noivas', beauty: 'Produção especial' }[item.dataset.category];
  lightbox.showModal();
  document.body.style.overflow = 'hidden';
}));
document.querySelector('#book-look').addEventListener('click', () => {
  lightbox.close();
  // The close event is queued; open the next dialog after it has been dispatched.
  setTimeout(() => openBooking(selectedService), 0);
});
document.querySelector('#year').textContent = new Date().getFullYear();

// Respect motion preferences; content stays visible when JavaScript is unavailable.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('pending');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.section-heading, .service-card, .about-copy, .steps article, .manifesto-inner').forEach(element => {
    element.classList.add('reveal', 'pending');
    observer.observe(element);
  });
}
let progressQueued = false;
function updateProgress() {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  document.querySelector('.reading-progress').style.transform = `scaleX(${range > 0 ? Math.min(1, window.scrollY / range) : 0})`;
  progressQueued = false;
}
window.addEventListener('scroll', () => {
  if (!progressQueued) { progressQueued = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
menu.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
});
function closeMenu() {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Abrir menu');
}
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeMenu(); menu.focus(); }
});
document.addEventListener('click', event => {
  if (!navigation.contains(event.target) && !menu.contains(event.target)) closeMenu();
});

}
initializeSite();
