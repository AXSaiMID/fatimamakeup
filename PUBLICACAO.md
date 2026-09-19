# Publicação da vitrine no GitHub Pages

Endereço público: **https://axsaimid.github.io/fatimamakeup/**

## O que estava errado

O Pages estava em “Deploy from a branch”, publicando a raiz com arquivos de desenvolvimento. Não executava o build do Vite e as URLs absolutas `/images/...` procuravam arquivos fora de `/fatimamakeup/`.

## Configuração correta (uma única vez)

1. Abra https://github.com/AXSaiMID/fatimamakeup/settings/pages
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Não use “Deploy from a branch” e não escolha a pasta raiz para o código de desenvolvimento.
4. Abra **Actions → Publicar vitrine no GitHub Pages** e confira a execução mais recente.
5. Aguarde os jobs **build** e **deploy** ficarem verdes e visite o endereço acima.

O workflow é executado automaticamente a cada push para `arena/01a0b680-fatimamakeup`. A implantação não depende de mesclar o pull request neste momento. Se mudar a branch de publicação no futuro, atualize o workflow e as regras do ambiente `github-pages` em conjunto.

## O que é publicado

Somente o conteúdo de `dist`, gerado por:

```sh
npm ci
npm test
npm run build:pages
```

A versão Pages usa o prefixo `/fatimamakeup/`, inclui fontes locais, imagens e JavaScript compilado. Não tenta chamar `/api/site`, e a rota `/admin/` explica a limitação da hospedagem em vez de oferecer um login inoperante.

### Disponível no GitHub Pages

- Site/vitrine responsiva.
- Navegação, filtros de inspirações e ampliação de fotos.
- Preparação e cópia de uma mensagem de consulta, sem envio automático.

### Não disponível nesta hospedagem

- Login e edição pelo painel administrativo.
- Banco de dados, uploads e catálogo dinâmico.
- Recebimento de solicitações, checkout ou pagamentos.

Não há produtos fictícios, contato de WhatsApp inventado ou credenciais publicados. O código do painel completo permanece no repositório para uma futura hospedagem Node com disco persistente.

## Atualizações futuras

1. Atualize o código/imagens na branch de publicação.
2. Faça commit e push.
3. Acompanhe o workflow em Actions.
4. Depois de concluído, atualize a página (Ctrl+F5 se o navegador mantiver a versão antiga).

## Desenvolvimento / hospedagem completa

`npm run dev` e `npm run build` continuam utilizando a versão completa com backend e admin. `npm run build:pages` é exclusivamente a vitrine estática. Após um build Pages, execute novamente `npm run build` antes de `npm start` para usar o painel completo.
