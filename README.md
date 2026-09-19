# Fátima Correa makeup

Site editorial responsivo com catálogo público e painel administrativo real em `/admin/` na versão com servidor.

## Vitrine no GitHub Pages

A publicação estática usa `npm run build:pages` e o workflow `.github/workflows/pages.yml`. Consulte **[PUBLICACAO.md](PUBLICACAO.md)** para o passo a passo e as limitações. No GitHub Pages, o painel e o banco **não** funcionam; a rota `/admin/` é apenas uma página informativa. A versão completa abaixo exige hospedagem Node.

## Requisitos e execução

Node.js **22.13+** (recomendado Node 24 LTS), npm e armazenamento local persistente.

```sh
npm ci
npm run dev          # Site + API + admin em 0.0.0.0:5173
```

O servidor integra Vite e Express na mesma origem. As chamadas do navegador usam URLs relativas, sem depender de localhost no computador da visitante.

## Primeiro acesso da administradora

1. Com o servidor configurado, execute **no terminal do servidor**:
   ```sh
   npm run admin:setup
   ```
2. Abra `/admin/` (ou o link **Área da profissional** no rodapé).
3. Informe o código de ativação de uso único mostrado no terminal, seu e-mail e uma senha de pelo menos 12 caracteres.
4. Depois da ativação, o código é removido e novos cadastros ficam bloqueados. Os próximos acessos usam apenas e-mail e senha.

**Não existe senha padrão.** Não publique o código de ativação e não versione a pasta de dados. O e-mail identifica a conta; não há serviço de envio de e-mail ou recuperação automática configurado.

Para recuperação excepcional, somente quem administra o servidor pode executar:

```sh
npm run admin:reset -- --confirm
npm run admin:setup
```

Isso remove o acesso anterior e encerra as sessões, mas preserva textos, produtos e imagens. Crie o novo acesso na tela `/admin/`. Use o mesmo `DATA_DIR` do servidor nos comandos administrativos.

## Funcionalidades

### Painel

- Visão geral e checklist de configuração.
- Produtos: cadastrar, editar, excluir, categoria, preço em reais ou “sob consulta”, foto, descrição, ordem e publicação/rascunho.
- Serviços: nome, título, frase curta, descrição, foto, ordem e publicação.
- Galeria: imagem, descrição acessível, categoria, título, ordem e publicação.
- Biblioteca: upload de JPG, PNG e WebP. Conversão para WebP, correção de orientação, remoção de metadados e redução para até 2200 px.
- Upload: até 10 MB e 40 megapixels por imagem; biblioteca limitada a aproximadamente 500 MB. SVG, arquivos não raster e imagens animadas não são aceitos. Vídeos não estão implementados.
- Exclusão de mídia bloqueada enquanto estiver em uso, inclusive em rascunhos.
- Conteúdo: títulos e texto da abertura, imagem e enquadramento, apresentação da profissional, foto e legenda, WhatsApp, Instagram, cidade, apresentação do catálogo e nota da galeria.
- Título/descrição da página atualizados no cliente. Não há renderização SEO dinâmica no servidor.
- Troca de senha, logout e exportação de conteúdo JSON (sem credenciais).
- Proteção contra sobrescrita de edições concorrentes e alertas para alterações não salvas.

### Site público

- Conteúdo carregado da API ao abrir ou atualizar a página.
- Apenas itens publicados aparecem para visitantes.
- Catálogo aparece quando habilitado e com pelo menos um produto publicado.
- Busca por nome/categoria, filtro de categorias e detalhes de produto.
- Consulta de produtos e solicitação de agendamento via WhatsApp quando configurado.
- Sem WhatsApp, o formulário prepara uma mensagem para copiar, sem envio ou confirmação automática.
- O catálogo é uma **vitrine**, não uma loja com checkout. Não há estoque, pedidos, pagamentos ou reserva de horários.

## Produção

```sh
npm ci
npm run build
PORT=5173 DATA_DIR=/caminho/persistente/fatima npm start
```

- `npm start` serve `dist`, a API e as imagens enviadas pela mesma aplicação.
- Não publique apenas `dist` em hospedagem estática: o painel precisa do servidor Node e do banco.
- Use **HTTPS** e proxy reverso confiável. `trust proxy` está configurado para um salto; ajuste conforme a infraestrutura. Cookies ficam `Secure` quando a requisição é HTTPS.
- Use uma instância Node com volume persistente. SQLite/arquivos locais não são adequados para múltiplas réplicas sem arquitetura adicional.
- Limites de login usam memória do processo e se reiniciam com o servidor; para produção de maior escala, adicione rate limiting compartilhado na infraestrutura.
- Aplique limites de upload também no proxy. Configure monitoramento e backups regulares.
- Teste os contatos reais antes de publicar e confirme autorização para uso das fotografias.

## Armazenamento e backups

`DATA_DIR` padrão: `.data/`, excluído do Git.

- `site.sqlite` e arquivos WAL/SHM: conteúdo, conta e sessões.
- `uploads/`: imagens otimizadas.
- `setup-token`: código de ativação enquanto não existe uma conta.

Para **backup completo**, pare o servidor e copie toda a pasta `DATA_DIR` para armazenamento seguro, incluindo o banco e as fotos. Restaure essa pasta antes de reiniciar. Proteja esses backups: incluem dados de autenticação.

A exportação JSON do painel é uma cópia de textos e referências das imagens, não um backup completo. Não inclui os arquivos das fotos, usuários ou sessões. Não há importação automática de JSON nesta versão.

## Segurança implementada

- Senhas com scrypt e sal aleatório.
- Sessões revogáveis no banco, tokens armazenados em hash, cookies HttpOnly/SameSite=Strict e validade de 8 horas.
- Verificação de origem, cabeçalho de requisição e token CSRF nas alterações autenticadas.
- Limite de tentativas de autenticação e validação de todos os campos da API.
- Processamento real dos arquivos de imagem: não confia apenas na extensão.
- Nomes aleatórios para uploads e bloqueio de diretórios privados na prévia.
- Nenhuma credencial embutida no frontend.

## Testes

```sh
npm test
npm run build
```

Testes automatizados de API cobrem ativação, acesso negado, CSRF, validação, upload, rascunhos, publicação, concorrência, serviços, galeria, exportação, persistência, troca de senha e exclusão.

Validação adicional em Chromium/Playwright, com banco de teste isolado: criação de acesso, login/logout, upload, produto publicado/rascunho/exclusão, edição do site, consulta via WhatsApp e layout nas larguras 320, 390, 768 e 1440 px.

## Conteúdo inicial

A capa usa a fotografia original da Fátima enviada pelo usuário (`09F89F0A-21A1-4707-9301-7CB7FAC0EED0.jpg`). As outras imagens iniciais continuam sendo referências ilustrativas geradas por IA, não trabalhos ou retratos da profissional. Na versão com servidor, essas imagens podem ser substituídas pelo painel. Nenhum produto fictício é publicado automaticamente.

## Estrutura

- `server/`: API Express, armazenamento SQLite e validação.
- `admin/`: painel responsivo.
- `src/`: site público e integração de conteúdo.
- `scripts/`: ativação e recuperação pelo responsável pelo servidor.
- `tests/`: testes de integração da API.
- `public/images/`: imagens de referência do modelo.

Fontes Cormorant Garamond e Manrope servidas localmente via `@fontsource`.
