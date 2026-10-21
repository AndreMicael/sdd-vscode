# Tasks: Instalação automática do Specify

**Input**: `specs/001-install-specify/` — spec.md, plan.md, research.md, data-model.md, contracts/specify-setup.md e quickstart.md.

**Prerequisites**: Design concluído; constituição ainda é template sem princípios ratificados. CommonJS, módulos nativos Node e API estável do VS Code >=1.85; sem framework de runtime.

**Tests**: Incluídos para comprovar os cenários de aceitação e SC-001 a SC-005 solicitados na especificação, conforme a estratégia de plan.md/quickstart.md. Escrever os testes de cada fase antes da implementação correspondente e observar falhas relevantes. Automação não instala ferramentas reais; aceitação de instalação usa contas/VMs descartáveis.

**Organization**: Tarefas por história; infraestrutura compartilhada precede todas. Todos os caminhos abaixo são relativos à raiz do repositório. `[P]` permite execução simultânea somente no grupo e após os pré-requisitos indicados. Nenhuma tarefa autoriza publicação ou instalação na conta pessoal.

## Phase 1: Setup

**Purpose**: Preparar os pontos de extensão e a validação no projeto existente.

- [X] T001 Criar os módulos CommonJS `specify-setup.js`, `specify-platform.js` e `specify-store.js` com interfaces injetáveis do contrato, sem importar vscode no núcleo, mantendo o projeto plano e sem dependências de runtime novas.
- [X] T002 Preparar os arquivos `test/specify-setup.test.js`, `test/specify-platform.test.js` e `test/specify-store.test.js` para node:test com adapters, diretórios temporários e limpeza; confirmar descoberta pelo script existente em `package.json` e preservação de `test.js`.

## Phase 2: Foundational — segurança e coordenação compartilhadas

**Purpose**: Impedir efeitos fora do escopo e concorrência antes de habilitar a primeira instalação.

- [X] T003 [P] Escrever testes em `test/specify-store.test.js` para escrita atômica, versão desconhecida, JSON ilegível/corrompido, consumo prévio da tentativa automática e disputa de lock por processos reais em temporários; provar exclusividade, liberação por token e bloqueio com identidade ambígua.
- [X] T004 [P] Escrever testes em `test/specify-platform.test.js` para classificação local/remoto/browser, raízes compartilhadas por editor/perfil, argumentos com espaços/Unicode, processos assíncronos, timeout, cancelamento de árvore e logs sem credenciais usando adapters de efeitos.
- [X] T005 Implementar SetupEnvironment em `specify-platform.js`: key como "Identificador local estável de usuário/host, não sincronizado", platform/arch como "Plataforma/arquitetura detectadas", editor/remoteName/uiKind com "Contexto; remoto/browser impede bootstrap", root como "Caminho absoluto fora de workspaces" e supported/reason como "Elegibilidade e motivo da limitação"; usar LOCALAPPDATA/sdd-speckit, Library/Application Support/sdd-speckit ou XDG_DATA_HOME/~/.local/share/sdd-speckit conforme research.md, com a mesma raiz entre VS Code/Cursor e perfis.
- [X] T006 Implementar persistência versionada por temporário + rename em `specify-store.js`: schemaVersion "Inteiro, inicialmente 1; desconhecido bloqueia escrita automática"; attemptId "ID aleatório que associa processos, resultado e lock"; automaticAttemptConsumed "Persistido antes de qualquer instalação"; startedAt/updatedAt/finishedAt "Datas UTC; fim ausente enquanto ativo"; installation "Registro opcional selecionado"; error "code, stage, message, exitCode opcional; sem credenciais"; recoveryActions "Ações válidas na situação". Leitura inválida e falha de escrita bloqueiam instalação automática e checking preserva o resultado anterior.
- [X] T007 Implementar em `specify-platform.js` execução assíncrona com executável absoluto, argumentos separados, shell=false e interpretador explícito para scripts; probes de 15 s e tentativa de até 10 min, encerramento confirmado da árvore Unix/Windows antes de liberar recursos, identidade/liveness dos processos e saída/logs limitados com remoção de credenciais.
- [X] T008 Implementar InstallationLock em `specify-store.js` com criação exclusiva, schemaVersion, token, attemptId, ownerPid, ownerStartedAt, heartbeatAt e childProcesses com PID/identidade; só o token proprietário libera após saída dos filhos; TTL isolado nunca permite remoção e liveness ambígua bloqueia concorrentes.
- [X] T009 Implementar em `specify-setup.js` createSpecifySetup({platform, store, report}), snapshot, subscribe/disposable e deduplicação por Promise; state com "Estados públicos: checking, installing, ready, failed, cancelled, unsupported. Auxiliares: idle, waiting, incompatible, interrupted, verification-required, repair-required."; stage "detect, lock, uv, python, specify, validate, terminal"; trigger "activation, retry, repair, recheck, command"; check/ensureReady seguem transições do modelo, apenas activation inicial sem candidato pode instalar automaticamente, sob lock e com nova descoberta; observadores aguardam e revalidam, falha/cancelamento/interrupção nunca liberam nova instalação automática.

**Checkpoint**: Processos, persistência e exclusividade seguros; nenhum caminho de instalação pode contornar esses controles.

## Phase 3: User Story 1 — Começar a usar sem instalação manual (P1) — MVP

**Goal**: Preparar uv/Python/Specify na primeira ativação local e disponibilizar o CLI nas ações e novos terminais sem tocar no projeto.

**Independent Test**: Em conta descartável sem ferramentas, instalar VSIX e abrir janela vazia sem painel; preparação inicia, mostra progresso, termina apenas após probes do CLI e shell; fixture permanece intacto e features/wiki continuam acessíveis. Repetir plataformas/editores suportados conforme matriz.

### Tests

- [X] T010 [P] [US1] Escrever em `test/specify-setup.test.js` testes de primeira ativação, dependências ausentes, etapas, tentativa consumida antes dos efeitos, ausência de workspace, remoto/browser sem download, CLI válido com terminal pendente e nenhuma chamada init/integration durante bootstrap.
- [X] T011 [P] [US1] Escrever em `test/specify-platform.test.js` testes de HTTPS/redirects/TLS, ambiente uv isolado, seleção ps/sh, PATH idempotente, perfis cmd/PowerShell/bash/zsh, perfil que redefine PATH e resultado de terminal com token/caminho divergente; sendText sozinho não comprova sucesso.
- [X] T012 [P] [US1] Acrescentar em `test.js` testes comportamentais com adapter VS Code para ativação sem workspace, registro de UI antes do bootstrap, gates antes de git switch/prompt/despacho, preservação de SPECIFY_FEATURE_DIRECTORY e fixture intacto; agente com integração existente, árvores e wiki permanecem utilizáveis.

### Implementation

- [X] T013 [US1] Implementar descoberta e probes em `specify-platform.js` por PATH, locais usuais e registro gerenciado sem varrer disco; executar version, init --help e integration install --help em cwd neutro, sem cores, exigindo zero e flags --here/--integration/--script no init e --script/--force na integração; SpecifyInstallation usa executable/binDirectory "Caminhos absolutos normalizados", origin "external ou managed", version "Versão retornada, não prova isolada de compatibilidade", capabilities "Resultados de init/integration e flags obrigatórias", checkedAt "Última verificação" e terminalVerified "Por janela/shell; não reutilizar prova de outro editor".
- [X] T014 [US1] Implementar download cancelável do instalador oficial Astral em `specify-platform.js` via HTTPS com TLS, timeout e redirects limitados; salvar antes de executar com interpretador explícito, reutilizar uv compatível ou instalar via UV_UNMANAGED_INSTALL na raiz gerenciada sem administrador nem edição de profiles.
- [X] T015 [US1] Implementar em `specify-platform.js` instalação uv tool install --python 3.11 specify-cli==1.2.2 usando PyPI oficial, UV_TOOL_DIR/UV_TOOL_BIN_DIR/UV_PYTHON_INSTALL_DIR/cache gerenciados, configuração uv isolada e cwd fora do workspace; preparar Python ausente e registrar versões resolvidas sem instalar Git/agentes.
- [X] T016 [US1] Implementar verificação de shell em `specify-platform.js` considerando perfil padrão e terminal.integrated.env, resolução do mesmo executável e execução confirmada; oferecer fallback de terminal com arquivo temporário restrito, token da tentativa, shell, código e caminho resolvido, usando runtime absoluto validado; shell não verificável fica verification-required e temporários da tentativa são limpos apenas dentro da raiz gerenciada.
- [X] T017 [US1] Conectar o fluxo inicial em `specify-setup.js` aos adapters completos: elegibilidade, descoberta, lock, redescoberta, persistência prévia, instalação, probes e validação por janela; candidato incompatível bloqueia instalação automática, e ready exige CLI e terminal confirmados; publicar etapas e resultados esperados como snapshots.
- [X] T018 [US1] Adicionar onStartupFinished em `package.json` e integrar serviço em `extension.js` após registrar UI/comandos sem aguardar rede/processos em activate; aplicar environmentVariableCollection.prepend('PATH', ...) idempotente aos novos terminais, apresentar progresso cancelável/estado e OutputChannel SDD: Specify, capturar rejeições inesperadas e atualizar painel explicitamente ao concluir.
- [X] T019 [US1] Aplicar ensureReady em `extension.js` antes do prompt/despacho de instalarSpecKit e do ramo integration install de rodar, inclusive antes de comandos preparatórios git switch; false impede efeitos e anúncio de conclusão. Usar executável/env validados, quoting por shell, ps no Windows/sh no Unix e preservar SPECIFY_FEATURE_DIRECTORY e confirmação de mudanças de projeto; integração já existente continua independente.

**Checkpoint**: MVP entrega instalação limpa, reutilização mínima segura e gates; recuperação avançada e aceitação de preservação continuam nas histórias seguintes.

## Phase 4: User Story 2 — Preservar uma instalação existente (P1)

**Goal**: Reutilizar cópias compatíveis, revalidar em reload/comandos e proteger o usuário em incompatibilidade e concorrência.

**Independent Test**: Com CLI compatível preexistente, comparar caminho, versão, arquivos e downloads antes/depois da ativação e reload: nenhuma alteração/download. Duas janelas compartilham no máximo um instalador e validam seus próprios terminais.

### Tests

- [X] T020 [P] [US2] Acrescentar em `test/specify-setup.test.js` cenários de candidato externo compatível sem downloads, incompatível sem substituição, ready persistido com reprobes, remoção/dano exigindo reparo, rechecagem reconhecendo reparo manual e duas instâncias observando resultado com terminal por janela.
- [X] T021 [P] [US2] Acrescentar em `test/specify-store.test.js` disputa multiprocesso na mesma raiz simulando janelas/editores/perfis, verificando máximo de um instalador, redescoberta antes de instalar e leitura do resultado por observadores; não limitar a prova a mocks de Promise.

### Implementation

- [X] T022 [US2] Completar política de seleção/revalidação em `specify-setup.js`: registro salvo é apenas pista, compatível existente não causa download/update, incompatível vira incompatible, cópia antes funcional removida/danificada vira repair-required; check/recheck/ensureReady não reinstalam e cada janela valida shell antes de ready.
- [X] T023 [US2] Completar observação interprocesso em `specify-store.js` e `specify-setup.js` com waiting, heartbeat/resultado e redescoberta protegida por lock; consumidor nunca herda terminalVerified de outro editor e não duplica instalação após liberação concorrente.
- [X] T024 [US2] Implementar repair() em `specify-setup.js` criando cópia gerenciada isolada somente após ação explícita, preservando cópia externa, rechecando realidade sob lock e priorizando a cópia escolhida apenas no ambiente do editor; aplicar novamente probes e validação do shell.
- [X] T025 [US2] Declarar sdd.verificarSpecify e sdd.repararSpecify em `package.json` e registrá-los em `extension.js` sem requisito de workspace; rechecagem faz só probes, reparo explica cópia isolada/prioridade no PATH antes da escolha, incompatibilidade/remoção exibem orientação e pendência de terminal pede reabertura/reload sem falso sucesso.

**Checkpoint**: Preservação, revalidação e coordenação entre janelas comprovadas sem substituição silenciosa.

## Phase 5: User Story 3 — Recuperar uma preparação interrompida (P2)

**Goal**: Diagnosticar, cancelar e retomar explicitamente sem bloquear recursos independentes nem repetir instalações automaticamente.

**Independent Test**: Bloquear rede em VM, observar etapa/causa/ações, reiniciar sem nova instalação, restaurar rede e usar nova tentativa até ready. Repetir cancelamento e fechamento; validar leitura de features/wiki e integridade do fixture.

### Tests

- [X] T026 [P] [US3] Acrescentar em `test/specify-setup.test.js` falhas de rede/permissão/disco/dependência/distribuição/persistência, retry após correção, cancelamento antes/depois da saída do filho, reload sem retomada, observadora cancelando somente espera e rechecagem reconhecendo instalação manual sem download.
- [X] T027 [P] [US3] Acrescentar em `test/specify-store.test.js` interrupção, dois recuperadores concorrentes, dono morto com filho vivo, PID reutilizado/liveness ambígua, lock de recuperação órfão e troca de token durante recuperação; demonstrar que nenhum caso inseguro inicia instalador.
- [X] T028 [P] [US3] Acrescentar em `test.js` testes de comandos de recuperação sem workspace, diagnóstico sanitizado com etapa/causa/ação, ausência de notificações repetitivas e bloqueio de ações dependentes durante falha/instalação, mantendo features/wiki disponíveis e fixture intacto.

### Implementation

- [X] T029 [US3] Implementar recuperação conservadora em `specify-store.js` com lock exclusivo de recuperação, confirmação de morte do proprietário e filhos, revalidação de token/liveness antes de remover lock e bloqueio em dúvida ou lock de recuperação órfão; classificar interrupção sem habilitar instalação automática.
- [X] T030 [US3] Completar retry(), cancel() e dispose() em `specify-setup.js`: retry reavalia realidade e autoriza instalação explicitamente sob lock; cancelamento/desativação encerram downloads/árvore própria e aguardam filhos antes de liberar lock, observadora cancela só espera, persistir failed/cancelled/interrupted sem anunciar sucesso nem repetir na ativação seguinte.
- [X] T031 [US3] Implementar em `specify-setup.js` diagnóstico e recoveryActions por erro/etapa, preservando causa conhecida e exitCode sem credenciais; oferecer retry/recheck/instruções manuais conforme estado, e tratar persistência ilegível/versão desconhecida por recuperação explícita sem sobrescrever esquema desconhecido automaticamente.
- [X] T032 [US3] Declarar sdd.prepararSpecify, sdd.cancelarSpecify e sdd.diagnosticoSpecify em `package.json` e conectar handlers em `extension.js`; integrar cancelamento do withProgress, Tentar novamente/Verificar novamente/instruções oficiais, notificações sem repetição a cada reload, diagnóstico sanitizado e descarte do serviço/subscrições no fechamento.

**Checkpoint**: Falha, cancelamento e interrupção têm diagnóstico e recuperação explícita com exclusividade mantida.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 [P] Atualizar `README.md` com instalação automática na primeira execução, conectividade/fontes oficiais, escopo usuário/SO/editor, terminais antigos/novos, incompatibilidade/reparo/retry, orientação manual e remoto/web; distinguir bootstrap de init/integração por projeto e agentes/Git separados, cobrindo FR-015.
- [X] T034 [P] Atualizar `.vscodeignore` para excluir `test/` e manter `test.js` excluído, garantindo inclusão de `specify-setup.js`, `specify-platform.js` e `specify-store.js` no VSIX sem ferramentas baixadas nem temporários.
- [X] T035 Executar npm test para `test.js` e `test/specify-*.test.js`, corrigir regressões e registrar comandos/resultados em `specs/001-install-specify/quickstart.md`; verificar invariantes por efeitos observáveis e hashes de fixture, não apenas correspondência de strings.
- [X] T036 Empacotar com npx @vscode/vsce package --allow-missing-repository e inspecionar o VSIX a partir de `package.json`/`.vscodeignore`; registrar em `specs/001-install-specify/quickstart.md` conteúdo, versão e resultado, sem publicar release.
- [X] T037 Executar a matriz de aceitação de `specs/001-install-specify/quickstart.md` em contas/VMs descartáveis Windows/macOS/Linux, VS Code mínimo/atual e Cursor, shells cmd/PowerShell/bash/zsh, instalação VSIX e scripts Windows, remoto/web, concorrência e recuperação; registrar SO/arquitetura/editor/shell, versões resolvidas, probes, downloads e máximo de instaladores, evidências SC-001 a SC-005 e células não executadas; não declarar suporte validado para células pendentes.

## Dependencies & Execution Order

```text
T001 → T002 → Foundational (T003–T009)
                    ↓
          US1 (T010–T019): MVP
                    ↓
          US2 (T020–T025): preservação completa
                    ↓
          US3 (T026–T032): recuperação completa
                    ↓
          Polish (T033–T037)
```

- T003/T004 podem avançar juntos; T005/T006 usam arquivos distintos, mas não têm marca global de paralelismo porque dependem dos testes correspondentes. T007 depende de T005; T008 depende de T006/T007; T009 integra T005–T008. A fundação bloqueia todas as histórias.
- Em US1, T010/T011/T012 são independentes entre si depois da fundação; T013–T016 editam o mesmo adapter e são sequenciais. T017 depende desses adapters; T018 integra serviço e ambiente; T019 depende de T018.
- US2 depende do fluxo e integração da US1; T020/T021 podem ser escritos juntos. T022–T025 são sequenciais. A política mínima de preservação já existe em T009/T013/T017 para que o MVP seja seguro.
- US3 depende do serviço e comandos de US2; T026/T027/T028 podem ser escritos juntos. T029 precede T030/T031 e T032 integra os resultados. Não paralelizar histórias inteiras porque alteram os mesmos módulos.
- T033/T034 podem avançar juntos após as histórias; T035 precede T036, e o VSIX inspecionado precede T037. Recursos externos ausentes na matriz são pendências documentadas, não testes aprovados.

## Parallel Examples by User Story

| História | Grupo paralelo após pré-requisitos | Arquivos independentes |
|---|---|---|
| US1 | T010 + T011 + T012 | test/specify-setup.test.js; test/specify-platform.test.js; test.js |
| US2 | T020 + T021 | test/specify-setup.test.js; test/specify-store.test.js |
| US3 | T026 + T027 + T028 | test/specify-setup.test.js; test/specify-store.test.js; test.js |

Esses exemplos descrevem oportunidades de execução futura; não exigem delegação para gerar este documento.

## Implementation Strategy

1. Entregar fundação e US1 como MVP: instalação limpa, progresso, confirmação real do CLI/shell e gates sem alteração automática de projeto. Validar o teste independente da história antes de avançar.
2. Acrescentar US2: demonstrar preservação, rechecagem, concorrência e reparo isolado. Instalação mínima compatível já é descoberta no MVP; esta fase completa os cenários de preservação.
3. Acrescentar US3: exercitar diagnóstico/recuperação e interrupções. Os bloqueios contra repetição e cancelamento seguro são pré-requisitos desde a fundação, não melhorias adiáveis.
4. Concluir documentação, regressão, pacote e matriz. Cada história pode ser testada por seus próprios cenários sobre a fundação e incrementos anteriores, sem exigir sucesso dos cenários de uma história posterior.

## Requirement Coverage

| Requisitos | Tarefas principais |
|---|---|
| FR-001/002/005 | T005, T014–T018, T037 |
| FR-003/008 | T011, T013, T016–T019, T037 |
| FR-004 | T013, T020, T022, T024–T025 |
| FR-006/007 | T007, T009, T018, T026, T030–T032 |
| FR-009 | T006, T009, T026, T030–T033 |
| FR-010 | T003, T008–T009, T021, T023, T027, T029 |
| FR-011/012 | T012, T019–T020, T022, T025, T028 |
| FR-013 | T010, T012, T015, T017, T028, T035, T037 |
| FR-014/015 | T004–T005, T010, T033, T037 |
| SC-001–SC-005 | Testes independentes das três histórias e T035–T037 |

## Notes

- Todos os itens começam pendentes; geração de tarefas não comprova implementação nem execução da matriz.
- Não alterar lib.js sem necessidade demonstrada; preservar comportamento existente e testes de regressão.
- Nenhum hook before_tasks/after_tasks foi encontrado: `.specify/extensions.yml` não existe nesta geração.

## Phase 7: Convergence

- [ ] T038 Corrigir em `specify-setup.js` a persistência de falha/cancelamento antes do início da instalação: cancelar a descoberta inicial atualmente deixa o estado ausente e permite instalar automaticamente no reload. Registrar a inelegibilidade automática sob coordenação segura, preservando esquema desconhecido e sem sobrescrever o resultado de uma janela proprietária; acrescentar em `test/specify-setup.test.js` regressões para cancelamento/falha antes da instalação, reload sem instalação e recuperação explícita, incluindo cancelamento de observadora. HIGH — F1, per FR-009, US3/AC2, T009, T026 e T030 (contradicts).
- [ ] T039 Corrigir em `specify-platform.js` a prova de terminal cmd para respeitar os argumentos do perfil efetivamente usado pelo editor: o ramo cmd atualmente substitui `profile.args` por `/u /c`, podendo executar AutoRun quando o perfil real usa `/d` e produzir uma prova diferente do novo terminal. Preservar a semântica do perfil ou manter verification-required quando não for possível reproduzi-la; acrescentar em `test/specify-platform.test.js` regressões para argumentos cmd e divergência de resolução provocada por AutoRun/PATH, exigindo o mesmo executável antes de ready. HIGH — F2, per FR-008, US1/AC3, T011 e T016 (partial).
- [ ] T040 Integrar em `extension.js` as recoveryActions do serviço às notificações e ao diagnóstico acionável: apresentar causa/etapa e ações adequadas na primeira falha/incompatibilidade da ativação, incluir Reparar quando indicado e encaminhá-lo à confirmação de cópia isolada existente; manter ações disponíveis após nova tentativa/rechecagem sem repetir alertas a cada reload. Atualmente a ativação usa notify=false e as notificações explícitas oferecem opções fixas sem Reparar. Acrescentar em `test.js` testes comportamentais de falha inicial, incompatibilidade, execução das ações e ausência de notificações repetidas. HIGH — F3, per FR-004, FR-009, US2/AC3, US3/AC1, T025, T028 e T032 (partial).
