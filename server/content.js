import { z } from 'zod';

const text = (max = 500) => z.string().trim().max(max);
const required = (max = 200) => text(max).min(1, 'Preencha este campo.');
export const imagePath = z.string().regex(/^\/(images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)|uploads\/[a-f0-9-]+\.webp)$/);
export const settingsSchema = z.object({
  heroTitle: required(80), heroAccent: required(60), heroDescription: required(300),
  heroImage: imagePath, heroImageAlt: required(200), heroPosition: z.number().min(0).max(100),
  aboutTitle: required(80), aboutAccent: required(80), aboutText: required(1800), aboutText2: text(1800),
  aboutImage: imagePath, aboutImageAlt: required(200), aboutCaption: text(140),
  whatsapp: z.string().regex(/^(\d{10,15})?$/, 'Use apenas números, com código do país e DDD.'),
  instagram: z.string().regex(/^([a-zA-Z0-9._]{1,30})?$/, 'Informe apenas o usuário, sem @ ou URL.'),
  city: text(120), galleryNote: text(500),
  catalogTitle: required(80), catalogDescription: text(500), catalogEnabled: z.boolean(),
  seoTitle: required(100), seoDescription: required(300),
});
export const schemas = {
  products: z.object({ name: required(120), description: text(2000), category: text(80), priceCents: z.number().int().min(0).max(100000000).nullable(), image: imagePath.nullable(), imageAlt: text(200), published: z.boolean(), order: z.number().int().min(0).max(9999) }),
  gallery: z.object({ title: required(100), image: imagePath, imageAlt: required(200), category: z.enum(['social', 'bridal', 'beauty']), published: z.boolean(), order: z.number().int().min(0).max(9999) }),
  services: z.object({ name: required(80), title: required(60), eyebrow: text(80), description: required(500), image: imagePath, imageAlt: required(200), published: z.boolean(), order: z.number().int().min(0).max(9999) }),
};
export const defaults = {
  heroTitle: 'Beleza que tem', heroAccent: 'assinatura.',
  heroDescription: 'Não é sobre ser outra pessoa.\nÉ sobre se reconhecer. E se sentir extraordinária.',
  heroImage: '/images/hero.jpg', heroImageAlt: 'Retrato editorial ilustrativo de maquiagem natural e iluminada', heroPosition: 79,
  aboutTitle: 'O meu olhar.', aboutAccent: 'A sua essência.',
  aboutText: 'Por trás da Fátima Correa makeup está Fátima Correa. E, no centro de cada produção, está você: seu estilo, seus traços e a forma como deseja se sentir.',
  aboutText2: 'A proposta é simples: valorizar a sua beleza com um olhar atento aos detalhes, para que você viva seu momento com leveza e confiança.',
  aboutImage: '/images/hero.jpg', aboutImageAlt: 'Detalhes de uma produção de beleza ilustrativa', aboutCaption: 'ESTUDO DE BELEZA · IMAGEM ILUSTRATIVA',
  whatsapp: '', instagram: '', city: '',
  galleryNote: 'Moodboard de referência · Imagens ilustrativas geradas por IA. Os trabalhos da Fátima serão adicionados em breve.',
  catalogEnabled: true, catalogTitle: 'Beleza para levar com você.', catalogDescription: 'Conheça a seleção da Fátima. Consulte disponibilidade e detalhes pelo WhatsApp.',
  seoTitle: 'Fátima Correa makeup — Sua beleza. Sua essência.', seoDescription: 'Fátima Correa makeup — maquiagem para valorizar a sua essência. Conheça as propostas de maquiagem social, noivas e produções especiais.',
};
export const initialServices = [
  { name: 'Maquiagem social', title: 'Social.', eyebrow: 'PARA CELEBRAR', description: 'Sua beleza em destaque.\nEm qualquer ocasião.', image: '/images/social.jpg', imageAlt: 'Inspiração de maquiagem social com olhos esfumados', published: true, order: 0 },
  { name: 'Maquiagem para noivas', title: 'Noivas.', eyebrow: 'PARA DIZER SIM', description: 'Um dia inesquecível.\nUma beleza que é sua.', image: '/images/bridal.jpg', imageAlt: 'Inspiração de maquiagem delicada para noivas', published: true, order: 1 },
  { name: 'Produção especial', title: 'Extraordinária.', eyebrow: 'PARA BRILHAR', description: 'Formaturas, ensaios e momentos\nque merecem um toque a mais.', image: '/images/beauty.jpg', imageAlt: 'Inspiração de maquiagem com batom vermelho', published: true, order: 2 },
];
export const initialGallery = [
  { title: 'Bronze glow', image: '/images/social.jpg', imageAlt: 'Inspiração de maquiagem bronze', category: 'social', order: 0, published: true },
  { title: 'Soft bride', image: '/images/bridal.jpg', imageAlt: 'Inspiração de maquiagem para noivas', category: 'bridal', order: 1, published: true },
  { title: 'Red statement', image: '/images/beauty.jpg', imageAlt: 'Inspiração de maquiagem com batom vinho', category: 'beauty', order: 2, published: true },
  { title: 'Natural beauty', image: '/images/hero.jpg', imageAlt: 'Inspiração de maquiagem natural', category: 'social', order: 3, published: true },
];
