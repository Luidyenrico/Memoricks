# Memoricks

Aplicação pessoal para memorizar palavras e expressões em vários idiomas, com flashcards, quiz de tradução e revisão espaçada. O frontend usa Next.js, React e TypeScript; a API usa FastAPI, SQLAlchemy e SQLite.

## Executar localmente

Requisitos: Python 3.10+ e Node.js 20.9+.

No primeiro terminal:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

No segundo terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abra http://localhost:3000. A documentação da API fica em http://127.0.0.1:8000/docs.

## Configuração

Copie `backend/.env.example` para `backend/.env` e preencha a chave da Groq para gerar conteúdo real. Sem chave, o modo de demonstração continua disponível, com conteúdo explicitamente identificado como simulado.

```env
GROQ_API_KEY=sua_chave_aqui
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
```

O banco padrão fica sempre em `backend/memoricks.db`, independentemente da pasta de execução. Para uma base SQLite separada, configure `DATABASE_URL`. As migrações de compatibilidade são executadas na inicialização da API; apenas importar os módulos não modifica o banco.

O CORS permite `http://localhost:3000` e `http://127.0.0.1:3000` por padrão. Para outro endereço de frontend, configure `CORS_ORIGINS` com origens separadas por vírgula. A aplicação continua destinada ao uso pessoal/local, sem autenticação.

Para apontar o frontend a outra API, crie `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Fluxos

- `/language`: seleção do idioma de estudo.
- `/`: painel de estatísticas e cadastro de termos.
- `/active`: lista em estudo, detalhes, edição manual e exclusão confirmada.
- `/review`: flashcards e quiz de tradução. `?all=true` inicia a prática dos termos ativos.
- `/mastered`: palavras e expressões dominadas.
- `/ai`: preferências para a próxima geração de conteúdo.
- `/profile`: idioma nativo.

Cada termo mantém seu idioma e o idioma das explicações. As listas usam o idioma de estudo selecionado. Ao cadastrar em outro idioma, o perfil passa a estudá-lo, exceto se ele for o próprio idioma nativo do perfil. Os termos existentes mantêm seu conteúdo.

O cadastro normaliza espaços e caracteres Unicode, verifica duplicatas no mesmo idioma e **aguarda a geração antes de salvar**. Em caso de falha do provedor, o novo termo não é persistido. Repetir o cadastro de um registro antigo com erro de IA só substitui seu conteúdo depois de uma geração bem-sucedida, preservando o identificador e o progresso. Não existe geração em segundo plano nem polling no frontend.

Tradução, significado, explicação, exemplos e dica são salvos juntos. As preferências globais ficam em `backend/app/ai_settings.json`; a API também aceita `custom_settings` em um cadastro. As opções visíveis são tamanho do significado, estilo de explicação, 2 a 4 exemplos e foco. Os campos legados `show_*` são mantidos por compatibilidade, mas não controlam a apresentação.

A revisão aceita:

| Resposta | Próxima revisão |
| --- | --- |
| Difícil | 5 minutos |
| Médio | 1 hora |
| Fácil | 1 dia |
| Erro no quiz (`again`) | Imediata |
| Dominei | Remove da fila ativa; exige classificação Fácil |

Datas são armazenadas em UTC no SQLite e enviadas pela API com fuso explícito. A interface apresenta horários locais. Registros incompletos ou com erros antigos de geração não entram na fila; podem ser corrigidos pela edição manual em “Em estudo”.

O quiz precisa de quatro traduções distintas no mesmo par de idiomas. Uma resposta correta agenda o termo para um dia depois; uma incorreta o mantém pendente. A tela só avança e contabiliza a resposta depois do salvamento. Se houver erro, permite tentar salvar a mesma resposta novamente.

## Organização do código

```text
backend/app/
  main.py             Aplicação, ciclo de vida e CORS
  database.py         Caminho do banco e sessões
  migrations.py       Compatibilidade com bases antigas
  models.py           Modelos de termo e perfil
  schemas.py          Validação e respostas da API
  crud.py             Consultas e persistência
  content.py          Normalização e leitura de conteúdo legado
  dates.py            Relógio UTC compatível com SQLite
  generation.py       Integração com IA e preferências
  languages.py        Idiomas suportados
  routers/            Endpoints de termos e perfil
frontend/src/
  app/                Páginas, layout e estilos
  components/         Navegação, modal, conteúdo/edição e quiz
  lib/                Cliente da API, idiomas, datas e tema
```

O conteúdo exibido e seu formulário de edição são compartilhados entre as telas. O modal mantém o foco por teclado; mensagens de erro ficam próximas das ações e preservam o que foi digitado. Os temas claro/escuro usam cores próprias para texto e controles, com suporte à preferência por menos animações.

## Verificação

Backend — testes com banco temporário e IA substituída, sem alterar dados pessoais:

```powershell
cd backend
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Os testes de navegador iniciam um servidor na porta 3100 e simulam as respostas da API, incluindo falhas de rede. Cobrem revisão, quiz, recuperação do salvamento, edição, modal, configurações e layouts. A disponibilidade e a qualidade das respostas reais da Groq dependem da chave, do modelo e da quota do provedor.
