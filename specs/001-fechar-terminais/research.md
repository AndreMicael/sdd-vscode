# Research: Reaproveitar o terminal da feature

Nenhum item ficou "NEEDS CLARIFICATION" no Technical Context. As decisões abaixo resolvem os pontos técnicos da spec.

## 1. Como saber se a IA ainda está ativa no terminal (FR-003)

- **Decision**: Usar a shell integration: `window.onDidStartTerminalShellExecution` marca o terminal da feature como ocupado; `onDidEndTerminalShellExecution` marca livre. Ocupado = IA ativa (só rodamos a IA ali; comandos `antes`, como `git switch`, terminam logo). Se `term.shellIntegration` não existir no momento do passo, ou a API não existir (VS Code < 1.93), abre terminal novo, como hoje.
- **Rationale**: É a única API estável que vê o que roda no terminal. Errar para "ativa" digitaria `/speckit-plan` no shell; errar para "inativa" abriria a IA dentro da IA. O fallback evita os dois.
- **Alternatives considered**: `processId` + lista de processos filhos (depende do SO, frágil); `onDidWriteTerminalData` (API proposta, indisponível em extensões publicadas); `term.state.isInteractedWith` (não diz se a IA saiu).

## 2. Como mandar o passo para a sessão ativa

- **Decision**: `term.sendText(lib.comMarcador(lib.invocacao(id, passo, args)), false)` e, ~150 ms depois, `term.sendText("\r", false)`.
- **Rationale**: TUIs (Claude Code, Codex) tratam digitação rápida como colagem; o Enter dentro da colagem vira quebra de linha em vez de enviar. Separar o Enter evita isso. Se a IA está respondendo, o texto entra na fila dela (edge case da spec), sem interromper.
- **Alternatives considered**: `sendText(texto)` com Enter automático (não envia em algumas TUIs); `shellIntegration.executeCommand` (só serve para o shell, não para dentro da IA).

## 3. Como relançar a IA quando ela já saiu

- **Decision**: Mesmo comando de hoje (`lib.comandoAgente(exe, prompt, shell)`, precedido dos `antes` do passo) via `term.sendText` no terminal existente.
- **Rationale**: Reaproveita o código atual; o env `SPECIFY_FEATURE_DIRECTORY` já está no terminal.

## 4. Terminal do Specify de feature nova (dir ainda não existe)

- **Decision**: Specify de feature nova (`dir = null`, `extension.js:409`) abre terminal novo e o registra como "nova" para `raiz + IA`, com a hora de abertura. No próximo passo de uma feature `D` sem terminal, se houver "nova" no mesmo `raiz + IA` e `D/spec.md` foi criado depois dessa hora, o terminal é adotado por `D`.
- **Rationale**: Sem isso, "Specify e depois Plan" (teste independente da US1) daria dois terminais. A checagem de horário impede que a feature B adote o terminal onde nasceu a feature A (FR-005).
- **Alternatives considered**: Ler o nome da feature da saída do terminal (frágil); prever o nome (`lib.proximoNumero` + `slug`) antes do Specify (o Spec Kit pode escolher outro nome).

## 5. Palavra-chave de fim (FR-007)

- **Decision**: Acrescentar ao prompt: `" Ao terminar, escreva a palavra pronto em maiúsculas, sozinha, na última linha."`. Detectar `PRONTO` (maiúsculas, palavra inteira) na saída lida por `execution.read()` da execução da IA, depois de tirar códigos ANSI.
- **Rationale**: O prompt ecoado no terminal tem a palavra em minúsculas, então não dispara sozinho; a busca sensível a maiúsculas pega só a resposta. Leitura em fluxo atende os 2 s do SC-005.
- **Alternatives considered**: Marcador tipo `[[SDD:FIM]]` (apareceria no próprio prompt ecoado); arquivo-sentinela escrito pela IA (exige permissão de escrita e mais instrução). Falsos positivos (redesenho da tela, palavra no meio do texto) são aceitos pela spec — o status volta a "em andamento" no próximo passo.

## 6. Onde mostrar o status

- **Decision**: Sufixo na descrição: ` · em andamento` / ` · passo concluído`, no topo da view "Onde estou" e no item da feature em "Features". Atualiza com o `atualizar()` que as views já têm.
- **Rationale**: Reaproveita as `description` que já existem; nada de UI nova.

## 7. Configuração

- **Decision**: `sdd.reaproveitarTerminal` (boolean, padrão `false`), lida com `getConfiguration("sdd")` a cada passo.
- **Rationale**: Mesmo padrão de `sdd.agente`/`sdd.orquestracao`; ler a cada uso cumpre FR-006 sem listener.
