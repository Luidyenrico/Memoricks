# Memoricks

Memoricks e uma aplicacao pessoal de flashcards para estudar palavras e expressoes em ingles. O projeto combina um frontend em Next.js com uma API em FastAPI, usa SQLite como banco local e pode usar a API da OpenAI para gerar automaticamente traducoes, significados, explicacoes, exemplos e dicas de memorizacao.

A ideia central e simples: o usuario cadastra um termo em ingles, o backend salva esse termo imediatamente, gera o conteudo didatico em segundo plano e depois o termo entra em uma fila de revisao espacada. Conforme o usuario revisa, ele classifica o termo como dificil, medio, facil ou dominado.

## Principais funcionalidades

- Cadastro de palavras ou expressoes em ingles.
- Geracao automatica de conteudo didatico com IA.
- Fallback local simulado quando `OPENAI_API_KEY` nao esta configurada.
- Dashboard com estatisticas de termos ativos, pendentes e dominados.
- Fila de revisao com card viravel.
- Agendamento simples de revisao por dificuldade:
  - `difficult`: revisar em 5 minutos.
  - `medium`: revisar em 1 hora.
  - `easy`: revisar em 1 dia.
  - `master`: marca como dominado, permitido apenas para termos ja classificados como `Easy`.
- Lista de termos ativos, com status da proxima revisao.
- Edicao manual do conteudo gerado para cada termo.
- Exclusao de termos ativos.
- Separacao de termos dominados por `word` e `expression`.
- Tela de configuracao da IA para ajustar tamanho, estilo, quantidade de exemplos e foco.
- Tema claro/escuro persistido em `localStorage`.

## Estrutura geral

```text
Memoricks/
+-- backend/
|   +-- app/
|   |   +-- main.py
|   |   +-- database.py
|   |   +-- models.py
|   |   +-- schemas.py
|   |   +-- crud.py
|   |   +-- ai_settings.json
|   |   +-- routers/
|   |       +-- terms.py
|   +-- memoricks.db
|   +-- requirements.txt
|   +-- README.md
+-- frontend/
    +-- src/
    |   +-- app/
    |   |   +-- page.tsx
    |   |   +-- review/page.tsx
    |   |   +-- active/page.tsx
    |   |   +-- mastered/page.tsx
    |   |   +-- ai/page.tsx
    |   |   +-- layout.tsx
    |   |   +-- globals.css
    |   +-- components/
    |   |   +-- Header.tsx
    |   +-- lib/
    |       +-- api.ts
    |       +-- theme.ts
    +-- package.json
    +-- README.md
```

## Tecnologias

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint

### Backend

- FastAPI
- SQLAlchemy
- SQLite
- Pydantic
- Uvicorn
- OpenAI SDK
- python-dotenv

## Como a aplicacao funciona

### 1. Cadastro de termo

O usuario cadastra uma palavra ou expressao pelo dashboard (`/`) ou pela tela de termos ativos (`/active`). O frontend chama:

```http
POST /terms/
```

O backend:

1. Remove espacos extras do termo.
2. Verifica duplicidade comparando o texto em lowercase.
3. Classifica como `word` se tiver uma palavra, ou `expression` se tiver mais de uma.
4. Salva imediatamente no SQLite com `generated_content` vazio.
5. Agenda uma tarefa em segundo plano para gerar o conteudo com IA.

Enquanto a IA processa, o frontend faz polling a cada 1,5 segundo para atualizar o termo quando o conteudo estiver pronto.

### 2. Geracao com IA

A geracao esta concentrada em `backend/app/routers/terms.py`.

O backend le as configuracoes de `backend/app/ai_settings.json`, monta um prompt em portugues brasileiro e tenta gerar um JSON estruturado com:

- `translation`
- `meaning`
- `explanation`
- `examples`
- `tip`

Se `OPENAI_API_KEY` nao existir no ambiente, a aplicacao nao quebra. Ela retorna um conteudo simulado, util para desenvolvimento local.

### 3. Revisao espacada

A tela `/review` busca termos pendentes:

```http
GET /terms/pending
```

Um termo fica pendente quando:

- `mastered` e `false`.
- `next_review_date` e menor ou igual ao horario atual.

Ao revelar o card, o usuario pode marcar:

- `Dificil (5m)`: agenda nova revisao em 5 minutos.
- `Medio (1h)`: agenda nova revisao em 1 hora.
- `Facil (1d)`: agenda nova revisao em 1 dia.
- `Dominei completamente`: marca como dominado, mas apenas se o termo ja estiver como `Easy`.

Tambem existe o modo "Revisar tudo de novo", usado quando nao ha pendencias mas existem termos ativos.

### 4. Termos ativos

A tela `/active` lista todos os termos que ainda nao foram dominados:

```http
GET /terms/active
```

Nessa tela e possivel:

- Adicionar novos termos.
- Ver se um termo ainda esta processando IA.
- Ver a data/status da proxima revisao.
- Expandir detalhes do conteudo gerado.
- Editar manualmente traducao, significado, explicacao, exemplos e dica.
- Excluir um termo.

### 5. Termos aprendidos

A tela `/mastered` lista termos dominados por tipo:

```http
GET /terms/mastered/word
GET /terms/mastered/expression
```

Ela separa palavras e expressoes em abas, mostra datas de cadastro/dominio e permite expandir ou editar o conteudo salvo.

### 6. Configuracoes da IA

A tela `/ai` permite alterar as preferencias usadas na proxima geracao de conteudo:

- Tamanho do significado.
- Estilo da explicacao.
- Quantidade de exemplos.
- Foco ou tom do aprendizado.

Essas preferencias sao persistidas em:

```text
backend/app/ai_settings.json
```

## Backend

O ponto de entrada da API e `backend/app/main.py`.

Ele:

- Carrega variaveis de ambiente com `python-dotenv`.
- Cria as tabelas do banco via `Base.metadata.create_all(bind=engine)`.
- Configura CORS liberado para desenvolvimento.
- Registra o router de termos.
- Expoe uma rota raiz simples em `/`.

### Banco de dados

O banco usa SQLite em:

```text
backend/memoricks.db
```

O modelo principal e `Term`, definido em `backend/app/models.py`.

Campos:

- `id`: identificador.
- `text`: texto do termo, unico.
- `type`: `word` ou `expression`.
- `generated_content`: JSON salvo como string.
- `difficulty_level`: `Difficult`, `Medium` ou `Easy`.
- `next_review_date`: proxima data de revisao.
- `mastered`: indica se o termo foi dominado.
- `created_at`: data de criacao.
- `mastered_at`: data em que foi marcado como dominado.

### Endpoints principais

```http
GET    /
GET    /terms/stats
GET    /terms/pending
GET    /terms/active
GET    /terms/mastered/{term_type}
GET    /terms/{term_id}
POST   /terms/
POST   /terms/{term_id}/review
PUT    /terms/{term_id}
DELETE /terms/{term_id}
GET    /terms/settings/ai
PUT    /terms/settings/ai
```

### Variaveis de ambiente do backend

Crie um arquivo `.env` dentro de `backend/` se quiser usar IA real:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5-nano
```

`OPENAI_MODEL` e opcional. Se nao for definido, o backend usa `gpt-5-nano`.

## Frontend

O frontend consome a API por meio de `frontend/src/lib/api.ts`.

Por padrao, ele usa:

```text
http://localhost:8000
```

Para apontar para outra API, crie um `.env.local` dentro de `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Rotas do frontend

- `/`: dashboard, estatisticas e cadastro rapido de termo.
- `/review`: revisao por flashcards.
- `/active`: termos ainda em estudo.
- `/mastered`: termos ja dominados.
- `/ai`: personalizacao do conteudo gerado por IA.

### Tema

O tema e controlado por:

- `frontend/src/lib/theme.ts`
- `frontend/src/components/Header.tsx`
- variaveis CSS em `frontend/src/app/globals.css`

A escolha do usuario e salva em `localStorage` com a chave:

```text
memoricks-theme
```

## Como rodar localmente

Use dois terminais: um para o backend e outro para o frontend.

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

A API ficara disponivel em:

```text
http://127.0.0.1:8000
```

Documentacao interativa:

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/redoc
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

A aplicacao ficara disponivel em:

```text
http://localhost:3000
```

## Scripts uteis

### Frontend

```powershell
npm run dev
npm run build
npm run start
npm run lint
```

### Backend

```powershell
uvicorn app.main:app --reload
```

## Observacoes importantes

- O projeto nao possui autenticacao; ele parece pensado como ferramenta pessoal/local.
- O CORS esta liberado com `allow_origins=["*"]`, adequado para desenvolvimento, mas nao para producao sem revisao.
- O banco e criado automaticamente quando a API inicia.
- O conteudo gerado pela IA e salvo como JSON em uma coluna `TEXT`, e convertido para objetos Pydantic na resposta da API.
- O schema `TermCreate` aceita `custom_settings`, mas a rota atual ainda usa as configuracoes globais de `ai_settings.json`.
- O schema `AISettings` possui campos `show_translation`, `show_meaning`, `show_explanation`, `show_examples`, `show_tip` e `custom_instructions`, mas a tela atual usa apenas as preferencias principais de tamanho, estilo, exemplos e foco.
- Existem arquivos gerados no workspace, como `frontend/node_modules`, `backend/venv`, `__pycache__` e `frontend/tsconfig.tsbuildinfo`; eles nao fazem parte da logica principal do projeto.

## Resumo da arquitetura

```text
Usuario
  |
  v
Frontend Next.js
  |
  v HTTP/JSON
FastAPI
  |
  v
SQLite
  ^
  |
Tarefa em background gera conteudo com OpenAI ou fallback local
```

Em resumo, Memoricks e um sistema local de memorizacao ativa para ingles: ele cadastra termos, gera material didatico com IA, organiza revisoes por dificuldade e mantem uma base de palavras e expressoes ja dominadas.
