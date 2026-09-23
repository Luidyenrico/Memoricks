# Memoricks

Aplicação pessoal para aprender qualquer assunto com temas, subgrupos e cards personalizáveis. Frontend em Next.js/React/TypeScript; API em FastAPI/SQLAlchemy/SQLite.

## Executar localmente

Requisitos: Python 3.10+ e Node.js 20.9+.

Na primeira instalação:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\frontend
npm ci
```

Para usar o sistema, mantenha dois terminais abertos. No primeiro, a partir da pasta do projeto:

```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

No segundo:

```powershell
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abra http://127.0.0.1:3000. Para encerrar, pressione Ctrl+C nos dois terminais. A documentação da API fica em http://127.0.0.1:8000/docs.

## Organizar e aprender

A hierarquia tem exatamente dois níveis: **tema → subgrupo → cards**. Cards pertencem somente a subgrupos.

A barra lateral fixa reúne quatro áreas; em telas pequenas, o botão de menu abre a navegação. A barra superior contém apenas a identificação da área e o controle de tema claro/escuro.

- **Início (`/`):** próxima revisão, totais de cards, aprendidos, em estudo e progresso geral. Atalhos para até seis subgrupos priorizam pendências; sem pendências, abrem a prática livre.
- **Meus temas (`/themes`):** biblioteca e revisão unificadas. O resumo mostra cards pendentes, total e aprendidos. Temas expansíveis mostram seus subgrupos com total de cards, aprendidos, percentual e pendências. **Ver cards** abre o conteúdo; **Revisar** inicia os pendentes e **Praticar** permite estudar os cards ativos quando a revisão está em dia. Sem cards disponíveis, a ação de revisão não aparece. O primeiro tema com pendências abre automaticamente; os demais carregam seus subgrupos ao expandir. Toda a criação, edição, exclusão e personalização continua nesta área, incluindo os detalhes de temas (`/groups/<id>`) e subgrupos (`/subgroups/<id>`). Os detalhes do tema também oferecem revisão por subgrupo. Cada subgrupo reúne Em estudo, Aprendidos e Configurações, além do editor de cards. Links antigos para `/review` redirecionam para `/themes`, preservando o tema indicado em `?group=`.
- **Estatísticas (`/statistics`):** situação atual e distribuição por grupo/subgrupo, filtros e gráficos de criação/aprendizado para 7, 30, 90 ou 365 dias, ou Desde o início (data do primeiro card existente na biblioteca até hoje, inclusive com filtros de grupo/subgrupo). O seletor de dia fixa a consulta. Passar o mouse sobre os gráficos mostra uma prévia temporária; ao sair, os gráficos voltam ao dia selecionado, sem mover o seletor. As séries usam as datas dos cards ainda existentes; exclusões alteram os totais históricos. Cards aprendidos sem data aparecem apenas nos indicadores. Não há histórico individual de revisões nem sequência de estudo registrada.
- **Configurações (`/settings`):** idioma padrão das explicações. Instruções específicas de um tema, subgrupo ou campo prevalecem sobre esse padrão.

O percentual representa a proporção dos seus cards marcados como aprendidos, não o domínio de todo um assunto. Temas e subgrupos só podem ser excluídos quando vazios; a exclusão individual de cards pede confirmação.

Nos detalhes de temas e subgrupos, **Voltar a Meus temas** retorna à biblioteca com o tema correspondente expandido. Na lista de cards, **Revisão pendente** indica o agendamento; **Ver / editar** abre os detalhes do card. A ação **Revisar agora**, acima da lista Em estudo, inicia uma sessão de revisão de verdade e retorna ao subgrupo ao sair. Quando não há pendências, mas existem cards disponíveis, a ação muda para **Praticar cards**.

## Criar e personalizar cards

Em um subgrupo, use **Criar card** e escolha:

- **Preencher manualmente:** preencha os campos sem chamar a IA.
- **Criar com IA:** forneça um assunto, pergunta, palavra ou conteúdo e pressione **Enter** (ou clique em **Criar card com IA**). A IA gera e salva um card diretamente, sem confirmação de prévia. O editor permanece aberto, limpa a entrada e posiciona o cursor para o próximo card. **Shift+Enter** insere uma nova linha. Edite ou exclua os cards depois na lista. Falhas preservam a entrada; repetir um salvamento após falha de conexão não gera nem duplica o card. A criação automática exige IA configurada. A edição/atualização de cards existentes continua usando prévia antes de confirmar alterações.

A IA recebe o título, descrição e contexto do tema, o contexto específico do subgrupo e as instruções de todos os campos. Os campos controlam conteúdo, detalhamento, limite de caracteres, formato e obrigatoriedade. Código é exibido como texto, nunca executado.

Na criação rápida com IA, os cards salvos aparecem imediatamente em **Criados agora**, abaixo da entrada, em uma única coluna no computador e no celular, com cada novo card ao final da lista. As miniaturas mostram um resumo compacto do primeiro campo preenchido da frente e do verso, com texto limitado a poucas linhas. **Editar card**, em destaque, abre todos os campos para conferência e correção ali mesmo; **Excluir card** pede confirmação. Essas ações preservam a entrada do próximo card. As miniaturas representam os cards criados enquanto o editor está aberto; ao fechá-lo, eles continuam disponíveis na lista do subgrupo.

### Criar vários cards com IA

No subgrupo, use **Criar vários cards com IA**, cole o material e clique em **Organizar perguntas**. São aceitos até 40.000 caracteres, com até 50 perguntas/assuntos por fila e 5.000 caracteres por entrada. Coloque cada pergunta em uma nova linha e suas respostas logo abaixo. A IA identifica os limites entre entradas; o sistema recorta o texto original sem reescrever nem descartar as respostas. Um cabeçalho comum, como o livro e capítulo, acompanha a geração de todos os cards. Confira a separação e edite/remova entradas antes de clicar em **Gerar cards**.

A geração segue os campos do modelo: aproveita respostas fornecidas e complementa exemplos, dicas, explicações ou respostas ausentes. Complementos criados pela IA não devem ser atribuídos ao livro. Os cards são gerados individualmente, em sequência, para limitar o tamanho das respostas e permitir retomada. Cada prévia pode ser revisada, editada ou removida antes de **Salvar N cards**.

Quando a Groq retorna limite (HTTP 429), a fila espera pelo menos 60 segundos, ou o prazo maior informado pelo provedor, e tenta novamente somente o item pendente. A contagem aparece na tela. Depois de cinco novas tentativas, ou quando o prazo informado supera dez minutos, a fila pausa para retomada manual, preservando o progresso. Limites diários também podem existir; um minuto não garante recuperação de toda quota. Falhas de conteúdo ficam marcadas para nova tentativa; falhas de rede ou mudança de contexto pausam a fila.

**Pausar geração** interrompe a espera ou para após a requisição atual. O rascunho é guardado no armazenamento da aba, inclusive ao fechar o editor ou recarregar a página. A geração exige a página aberta e precisa ser retomada após recarregar. Fechar a aba pode descartar o rascunho. A organização em lote requer uma chave de IA configurada.

O salvamento do lote é atômico: uma entrada inválida, duplicada ou com modelo antigo impede todo o lote. A confirmação pode ser repetida após falha de conexão sem duplicar cards. É possível salvar somente os cards já gerados, encerrando a fila e descartando os pendentes. A inicialização cria uma tabela auxiliar de confirmações, com backup da base existente antes dessa atualização.

Nas **Configurações** do subgrupo é possível adicionar, remover e reordenar até 20 campos, selecionar frente/verso, texto/lista/código, fonte padrão/serifada/monoespaçada, tamanho e cores do texto e do fundo. Existe uma prévia visual. Mantenha ao menos um campo obrigatório na frente e outro no verso. As cores automáticas acompanham o tema claro ou escuro; cores personalizadas são mantidas como escolhidas.

Cada card guarda uma cópia do modelo com que foi criado. Alterações de **fonte, tamanho, cor do texto e fundo** são aplicadas automaticamente aos cards existentes do mesmo subgrupo que tenham o campo com o mesmo identificador, incluindo os aprendidos. Conteúdo e progresso são preservados. Mudanças estruturais (campos, instruções e organização) continuam opcionais para cards antigos. Nos detalhes, **Editar card** mantém o modelo salvo; **Atualizar para o modelo atual** abre uma prévia com os campos compatíveis e informa quais serão removidos. Você pode completar a atualização manualmente ou gerar uma nova prévia com IA. Só salvar confirma a atualização; o progresso permanece.

## Revisão

As filas e listas pertencem a cada subgrupo. Não há quiz nesta versão. A revisão abre uma tela própria em `/review/<subgrupo>`, com o menu lateral oculto e sem rolagem da página. A sessão ocupa a largura disponível, mantendo o controle de tema e o botão de saída; ao sair, a navegação é restaurada. Clique no card para alternar entre pergunta e resposta. Conteúdos longos têm rolagem interna, preservando fontes e cores. Os controles ficam fixos na parte inferior. O X no canto superior direito encerra a sessão e volta ao ponto de entrada; as respostas já confirmadas continuam salvas. Sessões iniciadas em Meus temas voltam à biblioteca com o tema correspondente aberto; sessões abertas por link direto também retornam ali. Durante um salvamento, o X aguarda a confirmação da API.

| Resposta | Próxima revisão |
| --- | --- |
| Difícil | Em 5 minutos |
| Médio | Em 1 hora |
| Fácil | Em 1 dia |
| Dominei completamente | Vai para Aprendidos |

**Dominei completamente** só aparece após revelar a resposta de um card cuja classificação anterior é Fácil. O backend também verifica essa regra. Marcar Fácil em uma revisão libera a opção em uma revisão posterior; a prática livre permite revisar antes do agendamento.

A prática livre também atualiza o agendamento. A revisão só avança depois que a API confirma o salvamento. Para avançar ao próximo card, escolha uma classificação após revelar a resposta. Cada sessão carrega até 200 cards; listas têm busca e paginação. Datas são armazenadas em UTC e exibidas no horário local.

## IA e ambiente

### Acesso somente pelo Google

A tela de acesso usa apenas **Continuar com Google**. No primeiro acesso uma conta é criada; nos seguintes, o mesmo identificador Google recupera a conta e seus dados. As sessões usam cookies HttpOnly, com validade de 14 dias e revogação ao sair.

Cadastro e login por e-mail/senha foram removidos da interface e da API (`/auth/register` e `/auth/login` não existem mais). Não há senha do Memoricks para recuperar. A recuperação do acesso à conta Google é feita pelo próprio Google. Os dados e vínculos das contas existentes são preservados. Colunas históricas de senha permanecem no banco apenas por compatibilidade com migrações antigas, sem uso para autenticação; contas antigas com senha não são vinculadas automaticamente por coincidência de e-mail.

O modo de contas usa o SQLite existente. Antes de ativá-lo, instale as dependências atualizadas de `backend/requirements.txt` e configure `backend/.env` com `MULTIUSER_ENABLED=1`, `GOOGLE_CLIENT_ID`, `MEMORICKS_OWNER_EMAIL` e `CORS_ORIGINS`. Configure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` em `frontend/.env.local`. O e-mail proprietário recebe os temas, cards e configurações já existentes. A primeira inicialização cria um backup do banco antes de vincular esses dados; contas novas começam vazias. O acesso é aberto a qualquer conta Google autorizada pelo aplicativo OAuth.

Durante testes locais, adicione a origem exata do frontend ao cliente Google, incluindo a porta (por exemplo, `http://localhost:3001`); use o mesmo nome de host no frontend e na API para compartilhar o cookie. Para publicar, use `https://memoricks.tech`, `AUTH_COOKIE_SECURE=1` e sirva a API no mesmo domínio sob `/api`, encaminhando esse caminho ao FastAPI sem o prefixo `/api`. Configure `NEXT_PUBLIC_API_URL=https://memoricks.tech/api` no build do frontend. O botão de login usa o fluxo de janela do Google, sem URL de redirecionamento.

O login Google exige o cookie de desafio e o mesmo `nonce` no token assinado. Se o desafio expirar ou o carregamento do Google falhar, use **Tentar Google novamente**. A validação admite 60 segundos de diferença de relógio; mantenha o horário do servidor sincronizado. A consulta de certificados respeita o proxy e os certificados TLS configurados no ambiente do processo: corrija proxies inválidos no serviço que inicia a API, sem desligar essas configurações no código.

Depois da migração de contas, mantenha `MULTIUSER_ENABLED=1`. A API recusa iniciar esse banco em modo local para evitar expor os dados de todas as contas sem autenticação. Bancos locais ainda não migrados continuam funcionando sem login.

O Google OAuth precisa estar em modo de produção para aceitar qualquer conta; em modo de teste, só os usuários de teste conseguem entrar. O Client ID é público, mas não coloque o Client secret no repositório. Faça backups regulares do SQLite e dos arquivos de configuração do servidor.

Copie `backend/.env.example` para `backend/.env` e configure a Groq:

```env
GROQ_API_KEY=sua_chave_aqui
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
```

Sem chave, a geração entrega uma prévia marcada como demonstração. Preencha os campos manualmente para obter conteúdo de estudo. A disponibilidade de geração real depende do provedor e de sua quota. O limite de saída padrão é de 6000 tokens e pode ser ajustado por `GENERATION_MAX_TOKENS`.

O frontend usa `http://127.0.0.1:8000`. Para outro endereço, configure `NEXT_PUBLIC_API_URL` em `frontend/.env.local`. O CORS permite as origens locais na porta 3000; outras origens podem ser configuradas em `CORS_ORIGINS`.

O banco padrão fica em `backend/memoricks.db`, independentemente da pasta de execução. `DATABASE_URL` permite uma base SQLite alternativa. O sistema é local/pessoal, sem autenticação.

## Migração e dados antigos

A inicialização executa uma migração atômica e única para o modelo geral. Antes de qualquer mudança na base existente, cria um backup completo em `backend/backups/memoricks-before-v3-<data UTC>.db`. Se houver erro, a transação é revertida.

Os termos antigos vão para **Línguas → respectivo idioma**, preservando IDs, entrada, conteúdo, dificuldade, datas e estado aprendido. As tabelas antigas permanecem como arquivo sem alterações; a aplicação passa a usar a tabela `cards`. Dados legados incompletos ficam disponíveis para edição, mas fora da fila de revisão. As antigas preferências de IA são usadas para iniciar os modelos dos subgrupos de idiomas.

Também são criados **Tecnologia → Python** e **Tecnologia → IA**, inicialmente vazios. A marca de migração evita duplicações e não recria itens excluídos posteriormente.

Para voltar ao backup: pare o backend, guarde uma cópia do banco atual, restaure o arquivo de backup como `backend/memoricks.db` e use a versão anterior do código. Iniciar a versão atual sobre um backup antigo executa novamente a migração.

Atualizações usam versões para evitar sobrescrever edições feitas em outra janela. A versão do modelo também é conferida ao salvar. Se o contexto ou o modelo mudar durante uma geração, a prévia é recusada e a interface orienta a gerar novamente.

## Organização

```text
backend/app/
  models.py           Temas, subgrupos, cards e perfil
  schemas.py          Validação de modelos, campos e solicitações
  templates.py        Modelos iniciais e validação de conteúdo
  generation.py       Geração de uma prévia estruturada pela Groq
  migrations.py       Backup e migração dos dados antigos
  crud.py             Métricas, consultas e gravações com versão
  routers/            Endpoints de temas, subgrupos, cards e perfil
frontend/src/
  app/                Rotas e estilos globais
  components/         Telas, editor, revisão e componentes compartilhados
  lib/                API tipada, carregamento, datas, idiomas e tema
```

As rotas antigas `/language`, `/ai` e `/active` redirecionam para o início. `/mastered` leva a Meus temas e `/profile` leva a Configurações. Links antigos de revisão em `/subgroups/<id>?view=review` abrem a nova tela dedicada. As APIs antigas `/terms/*` foram substituídas; o quiz foi removido do frontend e do backend.

## Verificação

Backend, com bases temporárias e IA simulada:

```powershell
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador usam a API real na porta 8100 com banco descartável e sem a chave de IA. A interface de teste roda na porta 3100 e usa a pasta `.next-e2e`, separada da aplicação local. Somente os cenários de resposta da IA e de falha de rede usam interceptações. Os testes não modificam seus cards.
