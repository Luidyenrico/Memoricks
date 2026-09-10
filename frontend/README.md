# Memoricks - Frontend

Este é o frontend da aplicação **Memoricks**, construído com **Next.js**, **React**, **TypeScript** e **Tailwind CSS**.

## Requisitos

* Node.js 20.9.0 ou superior instalado.

## Como Executar Localmente

1. **Instalar as dependências:**
   ```bash
   npm ci
   ```

2. **Iniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

3. **Acessar o aplicativo:**
   * Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

## Estrutura do Código

* `src/app/page.tsx`: Dashboard inicial do aplicativo.
* `src/app/layout.tsx`: Layout raiz contendo fontes globais, metadados e estrutura HTML.
* `src/app/globals.css`: Folha de estilos globais carregando o Tailwind CSS v4.

## Verificação

- `npm run lint` verifica a qualidade estática.
- `npm run build` valida TypeScript e a compilação de produção.
- `npx playwright install chromium` instala o navegador de testes.
- `npm run test:e2e` valida fluxos e layouts com uma API simulada na porta 3100.

Veja o [README principal](../README.md) para configuração e funcionamento.
