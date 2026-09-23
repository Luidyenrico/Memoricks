# Revisão do Memoricks — 08/09/2026

> Registro histórico da revisão de 08/09. A versão de temas e subgrupos, implementada em 11/09/2026, substitui os fluxos de idiomas e remove o quiz descrito abaixo. Consulte o README.md para o funcionamento atual.

Revisão do código da aplicação, configurações e dependências do frontend. Escopo confirmado: correções, simplificação do código e UX; sem busca, filtros, importação/exportação ou novos recursos de produto.

## Correções aplicadas

| Problema encontrado | Resultado |
| --- | --- |
| Datas UTC sem indicação de fuso eram interpretadas como horário local | API envia fuso explícito; frontend também trata respostas antigas e mostra minutos/horas corretamente |
| Cliques repetidos nos flashcards podiam registrar mais de uma resposta e pular termos | Salvamento protegido; o próximo termo só aparece após sucesso |
| Quiz avançava e contabilizava acertos mesmo quando a gravação falhava | Contabilização após sucesso, bloqueio do avanço e tentativa de salvar novamente |
| Botão de revisão geral ignorava `?all=true` | Prática abre diretamente os termos ativos; embaralhamento corrigido |
| Voltar do quiz mantinha uma fila antiga de flashcards | Fila recarregada ao trocar de modo; respostas de carregamentos antigos são descartadas |
| Alternativas do quiz misturavam idiomas de explicação | Alternativas limitadas ao mesmo par de idiomas e a traduções distintas |
| Falha antiga de IA podia provocar exclusão antes de uma nova geração | Conteúdo anterior só é substituído após sucesso, preservando ID e progresso |
| Cadastro simultâneo e diferenças de Unicode/espaçamento permitiam duplicatas | Normalização e nova checagem dentro da transação de gravação |
| JSON antigo, inválido ou incompleto quebrava respostas ou entrava em revisão | Leitura tolerante, compatibilidade de exemplos antigos e exclusão desses registros da fila |
| Rota de cancelamento também apagava termos já prontos | Rejeita o cancelamento de termos com conteúdo pronto |
| Arquivo de preferências podia ser gravado parcialmente; falha de gravação parecia sucesso | Substituição atômica e resposta de erro em caso de falha |
| Preferências individuais de geração eram ignoradas | `custom_settings` e instruções adicionais são usadas na geração |
| Caminho relativo do SQLite podia abrir outra base dependendo da pasta de execução | Caminho padrão fixo em `backend/memoricks.db` |
| Importar a aplicação executava alterações de esquema | Migrações no ciclo de inicialização, com teste de repetição e preservação de dados |
| Perfil podia ficar com o mesmo idioma nativo e de estudo após um cadastro | Cadastro mantém a consistência do perfil |
| Alertas conhecidos nas dependências do frontend | Next.js e configuração ESLint atualizados para 16.3.4; dependências indiretas corrigidas |

## Código limpo e UX

- Conteúdo e edição compartilhados em `TermContent`, usados pelas listas; apresentação compartilhada também no cadastro e na revisão.
- Separação de geração de IA, migrações, datas e compatibilidade de conteúdo em módulos próprios.
- Remoção do polling obsoleto e de arquivos de exemplo sem uso.
- Padronização de formatação do frontend e atualização da documentação ao comportamento atual.
- Modal nativo com foco inicial, navegação por teclado, Escape e restauração do foco.
- Rótulos associados aos campos, identificação da navegação atual, foco visível e link para pular ao conteúdo.
- Texto maior, seletores reorganizados no celular, botões mais fáceis de tocar e cores de texto próprias para cada tema.
- Suporte a menos animações conforme a preferência do usuário.
- Mensagens de erro junto às ações, preservação de campos e de rascunhos ao recolher um termo.
- Configurações bloqueadas quando a leitura inicial falha, evitando sobrescrever preferências com valores padrão.
- Conteúdo simulado identificado como demonstração, sem se apresentar como tradução real.

## Verificação

- 18 testes do backend: concorrência, migração, preservação de registros, datas, validação, configurações, edição e quiz.
- 11 testes de navegador: revisões, salvamento com falha/repetição, modal, edição, painel, preferências e layouts.
- Telas verificadas em ambos os temas no celular; navegação adicional em 1024 e 1440 pixels. Inspeção visual de capturas do modal e das listas.
- Fuso dos testes de navegador: `America/Sao_Paulo`, incluindo compatibilidade com datas antigas sem sufixo UTC.
- ESLint, TypeScript/compilação de produção e consistência das dependências Python verificados.
- Auditoria npm: zero vulnerabilidades conhecidas ao concluir a revisão, tanto em produção quanto no conjunto completo.

## Limites e dados existentes

Os testes usam bancos temporários e respostas simuladas de IA/API. O banco pessoal e a chave da Groq não foram usados para gerar conteúdo de teste. As migrações serão executadas quando a API for iniciada.

A disponibilidade e a qualidade de respostas reais da Groq não foram verificadas. A aplicação continua pessoal/local, sem autenticação. O CORS padrão foi limitado aos endereços locais e pode ser configurado por variável de ambiente.

O cliente de testes instalado emite um aviso de depreciação de Starlette/httpx; os testes passam. Isso pertence às dependências de desenvolvimento, não a uma falha observada nos fluxos da aplicação.

As alterações de idiomas, perfil e identidade visual que já existiam no workspace foram preservadas. Arquivos de trabalhos anteriores fora do código da aplicação não foram removidos. Não houve commit nem publicação.
