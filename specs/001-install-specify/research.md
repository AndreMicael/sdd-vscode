# Pesquisa: preparação do Specify

Data: 2026-10-21. Decisões de planejamento; nenhuma instalação real foi executada.

## 1. Ativação e pontos de integração

**Decision**: Adicionar `onStartupFinished`; registrar UI antes de iniciar serviço em background. Não mudar extensionKind para UI, pois a extensão também lê projetos. Bloquear bootstrap se `env.remoteName` existir ou uiKind indicar navegador, independentemente da localização do host. A extensão atual é Node sem entrypoint web: em navegador, a indisponibilidade indicada pelo editor/pacote e README comunica a limitação; não criar suporte web nesta feature.

**Rationale**: A ativação atual depende de workspace ou view. `terminal()` só chama sendText sem acompanhar conclusão. `instalarSpecKit()` retorna true ao despachar, não ao concluir; não reutilizá-lo como prova de bootstrap. `rodar()` instala integração quando ausente. Usar gates antes desses despachos; agente com integração existente não depende artificialmente do CLI.

**Alternatives considered**: Instalar apenas pelo instalar.ps1 não atende VSIX direto; ativação `*` antecipa trabalho sem necessidade; exigir CLI para toda ação bloqueia funções independentes. As chamadas atuais fixam `--script ps`; escolher ps em Windows e sh em Unix para cumprir escopo multiplataforma.

Fontes: código local e [eventos de ativação](https://code.visualstudio.com/api/references/activation-events#onStartupFinished).

## 2. Distribuição e dependências

**Decision**: Usar `uv tool install --python 3.11 specify-cli==1.2.2` em ambiente gerenciado. 1.2.2 foi a versão estável observada nos metadados PyPI; deve passar nos testes antes de publicar a extensão. Instalar uv ausente pelo instalador oficial Astral, baixado para arquivo antes de executar por sh/PowerShell; `UV_UNMANAGED_INSTALL` aponta para diretório próprio. Definir `UV_TOOL_DIR`, `UV_TOOL_BIN_DIR`, `UV_PYTHON_INSTALL_DIR` e cache sob a raiz gerenciada. Usar configuração uv isolada e cwd fora de projeto. Reutilizar uv compatível; permitir que uv baixe Python 3.11 ausente. Não usar administrador nem gerenciador de pacotes de sistema.

**Rationale**: PyPI é canal oficial e dispensa Git para instalar o CLI. Python >=3.11 é exigido. Git continua pré-requisito das funções Git do painel, mas é opcional para o CLI atual; não é dependência que o bootstrap precisa instalar.

**Alternatives considered**: Fonte Git exige dependência extra; main móvel reduz previsibilidade; pip global modifica ambiente externo; embutir Python no VSIX aumenta manutenção. Fixar Specify não fixa transitivas: registrar versões resolvidas e executar matriz antes da publicação.

Fontes: [instalação oficial](https://github.github.io/spec-kit/installation.html), [metadados PyPI](https://pypi.org/pypi/specify-cli/json), [pyproject](https://github.com/github/spec-kit/blob/main/pyproject.toml), [instalador uv](https://docs.astral.sh/uv/reference/installer/), [Python pelo uv](https://docs.astral.sh/uv/guides/install-python/).

## 3. Compatibilidade

**Decision**: Buscar pelo PATH, locais usuais de ferramentas do usuário e registro gerenciado, sem varrer disco. Executar `specify version`, `specify init --help` e `specify integration install --help` sem efeitos no projeto. Exigir exit zero e flags `--here`, `--integration`, `--script` no init; `--script` e `--force` em integration install. Executável absoluto, argumentos separados, timeout, cores desabilitadas e cwd neutro. Compatibilidade é por capacidades, com versão para diagnóstico.

**Rationale**: Localizar arquivo/version não prova operações utilizadas; versões antigas podem aceitar --ai em vez de --integration.

**Alternatives considered**: specify check pode avaliar agentes fora de escopo; executar init real como probe altera arquivos; instalar sempre viola preservação. Candidato incompatível suspende instalação automática. Reparar explica e cria cópia isolada, priorizada no editor, sem apagar/atualizar a externa.

Fonte: [limitações de versões antigas](https://github.github.io/spec-kit/installation.html) e comandos de extension.js.

## 4. PATH e validação de terminal

**Decision**: Preparar env dos subprocessos e usar `context.environmentVariableCollection.prepend('PATH', bin + path.delimiter)` para novos terminais, idempotentemente. Não editar profiles/PATH global. Probes usam ambiente efetivo do terminal, incluindo configurações terminal.integrated.env e perfil padrão. Executar shell suportado com inicialização correspondente; se não puder reproduzir o perfil com segurança, manter verification-required e abrir terminal de validação, que escreve resultado e caminho resolvido em arquivo temporário com token da tentativa. Não interpretar sendText como sucesso. Helper de resultado usa caminho absoluto de runtime disponível, sem presumir node no PATH; se o host Electron for usado, validar modo Node e disponibilidade no editor alvo. Sem adapter verificável, permanecer pendente e orientar configuração manual/rechecagem.

**Rationale**: Terminais antigos não recebem o novo ambiente, e profiles podem sobrescrever PATH. ready exige execução confirmada no CLI e no shell, com mesmo executável selecionado. Se necessário, orientar reabertura de terminal/editor antes de revalidar.

**Alternatives considered**: PATH global afeta outros programas; apenas caminho absoluto não disponibiliza comando ao usuário; APIs recentes de shell integration podem não existir no VS Code mínimo. Usar adapters cmd/PowerShell/bash/zsh e arquivo de resultado não depende de leitura de saída por API proposta.

Fonte: [EnvironmentVariableCollection](https://code.visualstudio.com/api/references/vscode-api#EnvironmentVariableCollection). A estratégia de probes é decisão do projeto; a matriz precisa demonstrar a implementação.

## 5. Persistência, lock e cancelamento

**Decision**: Raiz compartilhada por usuário: `%LOCALAPPDATA%/sdd-speckit` (Windows), `~/Library/Application Support/sdd-speckit` (macOS), `${XDG_DATA_HOME:-~/.local/share}/sdd-speckit` (Linux). Lock por criação exclusiva; registrar token, PID, início, heartbeat e filhos. Escrever estado por temporário + rename. Repetir descoberta dentro do lock. Janelas concorrentes observam resultado e validam seu próprio PATH.

**Rationale**: globalState e Promise local não coordenam editores/processos distintos. Persistência impede instalação repetida após falha/cancelamento. Registrar consumo da tentativa automática antes de iniciar processos.

**Alternatives considered**: Expiração temporal isolada permite duplicação com processo lento. Recuperar apenas após confirmar morte do dono e filhos; identidade/liveness ambígua exige recuperação explícita sem instalar. Serializar recuperadores com criação exclusiva de lock de recuperação e rechecagem do token; só remover lock cujo proprietário foi verificado. O lock de recuperação também segue política conservadora se órfão.

Cancelar interrompe download e árvore de processos (grupo Unix dedicado; árvore por PID Windows), aguardando saída antes de liberar lock. A janela observadora cancela só sua espera. Cancelamento após arquivos instalados não anuncia sucesso; próxima rechecagem reconhece realidade. Interrupção por fechamento requer tentativa explícita, sem reinstalação automática. Limpeza restrita a temporários da tentativa dentro da raiz gerenciada.

## 6. Testes e governança

**Decision**: Adapters simulados para lógica, processos reais para lock em pasta temporária, aceitação de instalações em VMs/contas descartáveis. Não instalar ferramentas nesta máquina durante o planejamento. Constituição atual é template sem princípios ratificados; registrar limitação sem inventar regras.

**Rationale**: Testes de strings não provam concorrência, preservação ou PATH; mocks de tudo escondem corridas.

**Alternatives considered**: Aceitação em um único SO não demonstra suporte prometido. Manter matriz e registrar explicitamente células não executadas.
