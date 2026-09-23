# Revisão das contas e correções de login — 23/09/2026

Revisão concentrada nas alterações recentes de autenticação e nos caminhos de frontend, API, perfis, propriedade dos dados e migrações que elas afetam. Também foram inspecionadas as consultas de cards, grupos, estatísticas e geração. Este documento não certifica que todo o aplicativo está livre de falhas.

## Problemas confirmados e corrigidos

| Prioridade | Problema e evidência | Correção |
| --- | --- | --- |
| Alta | Após migrar contas, iniciar com `MULTIUSER_ENABLED=0` fazia `authenticate_db` dispensar autenticação e os filtros de proprietário. A inicialização aceitava essa configuração. | A inicialização recusa abrir um banco já migrado sem contas habilitadas. O modo local de bancos não migrados permanece disponível. |
| Alta | `/auth/google` aceitava o nonce enviado no corpo quando o cookie estava ausente, inclusive depois da expiração do cookie. Também aceitava um token sem nonce, embora o frontend configure esse campo no GIS. Os dois testes anteriores validavam esses comportamentos incorretos. | Cookie obrigatório e comparação obrigatória com o nonce do token assinado. O nonce no corpo apenas detecta uma aba desatualizada. Testes agora exigem rejeição e ausência de sessão. |
| Média | Emissor diferente do Google provoca `GoogleAuthError`, não capturado anteriormente: um token de teste assinado reproduziu HTTP 500. | Exceção tratada como 401. Falha de transporte permanece 503; falta de configuração do client ID também retorna 503. |
| Média | `bool(email_verified)` considerava a string `"false"` verdadeira. | Exigido booleano `True`. Reproduzido com token assinado pela chave de teste; não pressupõe que o Google emita esse formato incorreto. |
| Média | Duas primeiras consultas do perfil da mesma conta tentavam inserir a mesma chave de proprietário. Teste com duas sessões simultâneas reproduziu `UNIQUE constraint failed: user_profiles.user_id`. | Inserção atômica que preserva o registro existente e consulta o perfil vencedor, sem sobrescrever preferências. |
| Média | Duas inicializações podiam observar a migração pendente antes de adquirir o bloqueio. Teste simultâneo reproduziu `UNIQUE constraint failed: schema_migrations.name`. | A migração de contas verifica novamente sua conclusão dentro da transação com bloqueio de escrita. |
| Média | Falha do script Google ou expiração do cookie deixavam o botão preso ao estado inicial, sem renovar o desafio pela interface. Métodos de login também podiam disputar a mesma sessão. | Nova tentativa explícita, compartilhamento da inicialização pendente entre execuções do efeito e bloqueio do formulário/botão enquanto autentica. Testado no navegador. |
| Média | O transporte criado por login não era fechado e ignorava todas as configurações do ambiente com `trust_env=False`, incluindo proxy e CA de TLS; a consulta podia usar o timeout padrão de 120 segundos. | Transporte fechado por contexto, respeito ao ambiente e timeout de 10 segundos por consulta. Logs não registram mensagens arbitrárias com claims do token. |

## Validação

- 53 testes de backend passaram em bancos temporários. Incluem isolamento entre contas Google e senha, propriedade nas leituras/mutações, migrações, cards, lotes e estatísticas.
- Tokens de teste assinados com RSA passam pelo verificador real do Google; somente a obtenção dos certificados é substituída. Verificados: tolerância de 21 segundos, rejeição de 120 segundos no futuro, expiração, assinatura alterada, público/client ID, emissor, nonce e e-mail não verificado.
- 4 testes de autenticação em Chromium passaram: cadastro/login/logout, formulário móvel, recuperação após falha do script Google e renovação de cookie ausente. O GIS é simulado; nenhuma credencial real é utilizada.
- ESLint, TypeScript e `git diff --check` passaram.
- O banco real e os processos do aplicativo em uso não foram alterados por estes testes. O login real em uma conta Google não foi repetido nesta revisão.

## Limitações que permanecem

- **O banco atual é SQLite, não PostgreSQL.** `database.py` usa argumentos de conexão SQLite; migrações usam `BEGIN IMMEDIATE`, `INSERT OR IGNORE` e backups SQLite. Trocar somente `DATABASE_URL` não torna PostgreSQL funcional. Uma migração completa exige trabalho próprio e não foi misturada a estas correções.
- **Não existe confirmação de e-mail nem recuperação de senha.** O sistema não comprova propriedade de um e-mail cadastrado por senha; um terceiro pode reservar um endereço ainda livre. Contas com senha não são mescladas automaticamente com Google, e a conta proprietária existente continua protegida contra cadastro por senha. São funcionalidades pendentes, não recursos implementados.
- **O isolamento combina filtros ORM com condições explícitas nas consultas e mutações.** Os endpoints existentes foram conferidos e os testes de duas contas passaram, mas SQL bruto e novas consultas fora dessas funções precisam de verificação de proprietário própria.
- **Não houve teste de carga.** Estatísticas percorrem as datas dos cards selecionados, e cada login Google consulta certificados. Os testes funcionais não demonstram capacidade para muitos usuários simultâneos.
- **Ambiente de execução:** o processo da API precisa ter acesso aos certificados do Google por uma configuração de rede válida. Uma variável de proxy inválida deve ser corrigida no lançamento do serviço; não é justificativa para desativar a validação do token ou ignorar todas as configurações de rede.

Referências consultadas: [nonce no GIS](https://developers.google.com/identity/gsi/web/reference/js-reference#nonce), [exceções e tolerância de relógio no google-auth](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html). A documentação da versão instalada do Next.js também foi consultada antes de editar o frontend.
