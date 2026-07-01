# Rota Comercial — App do Vendedor

App web instalável no iOS/Android (PWA) para controlar estoque, cadastrar produtos com foto/preço/código de barras, e montar um portfólio para mostrar ou enviar aos clientes.

## O que tem

- **Estoque** — lista de produtos com contador rápido (+ / −) e alerta de estoque baixo.
- **Produtos** — cadastro com nome, código de barras (digitado ou escaneado), preço, foto e estoque mínimo.
- **Portfólio** — grade visual (foto + preço) para mostrar ou enviar aos clientes, com botão para **compartilhar a imagem do produto com o preço** direto pelo WhatsApp (ou baixar a imagem).
- **Modo cliente** — vitrine em tela cheia, um produto por vez, para o cliente folhear sozinho (desliza ou toca nas setas).
- **Proteção por PIN** — toda vez que o app abre, pergunta se você quer o **Portfólio** (modo seguro, sem acesso ao estoque) ou o **Controle** (área do vendedor, pede PIN). Também tem um botão de cadeado no topo da área de Controle que trava o app no Portfólio na hora, pronto para entregar o celular ao cliente — para voltar ao Controle, precisa digitar o PIN de novo.
  - **PIN padrão: `1234`** — troque assim que possível pelo ícone de engrenagem no topo da área de Controle.
  - Importante: essa proteção é pensada para evitar que o cliente mexa sem querer no estoque durante uma visita — não é uma segurança forte (os dados continuam no navegador do celular). Não é indicada para proteger informação sensível.
- **Scanner de código de barras** — usa a câmera do celular (botão no topo e botão flutuante), reconhece EAN-13, UPC, Code128 e outros formatos comuns de mercado.

## Como funciona o armazenamento

Os dados ficam salvos **no próprio celular** (localStorage do navegador), então funciona offline e não precisa de servidor nem de login. A única coisa a saber: se o vendedor trocar de celular ou limpar os dados do navegador, o catálogo se perde — se isso for um problema, posso evoluir para salvar na nuvem (Firebase, como fizemos no outro app) para sincronizar entre aparelhos.

## Como publicar (igual fizemos antes)

Mais simples via **Vercel**:

```bash
cd vendedor-app
npx vercel --prod
```

Ou arraste a pasta `vendedor-app` para [vercel.com/new](https://vercel.com/new) (deploy sem precisar de conta de desenvolvedor).

Também funciona no **Firebase Hosting**:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # escolha a pasta vendedor-app como "public"
firebase deploy
```

## Como instalar no iPhone do vendedor

1. Abrir o link publicado no **Safari** (importante: precisa ser Safari, não Chrome).
2. Tocar no botão de compartilhar (quadrado com seta).
3. Tocar em **"Adicionar à Tela de Início"**.
4. Pronto — abre em tela cheia como um app normal, com ícone próprio.

## Observação sobre a câmera

A leitura de código de barras só funciona com o site publicado em **HTTPS** (Vercel e Firebase já entregam isso automaticamente) — não funciona abrindo o arquivo direto do computador.
