---

description: "Task list for feature implementation: Reaproveitar o terminal da feature entre passos"
---

# Tasks: Reaproveitar o terminal da feature entre passos

**Input**: Design documents from `/specs/001-fechar-terminais/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Inclui testes unitários em `test.js` para as funções puras de `lib.js`, conforme definido em `plan.md` e `quickstart.md`.

**Organization**: As tarefas estão agrupadas por user story para permitir implementação e validação independentes de cada história.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: A qual user story a tarefa pertence (`[US1]`, `[US2]`)
- Caminhos de arquivo exatos incluídos em todas as descrições

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Funções puras de marcador de fim de passo e respectivos testes unitários sem dependência da API do VS Code.

- [X] T001 Exportar as funções puras `comMarcador(prompt)` (retorna `prompt + " Ao terminar, escreva a palavra pronto em maiúsculas, sozinha, na última linha."`) e `temMarcador(texto)` (remove códigos ANSI e retorna `true` se contém `PRONTO` como palavra inteira em maiúsculas) em `lib.js`
- [X] T002 [P] Adicionar testes unitários para `comMarcador` e `temMarcador` (cobrindo saída com códigos ANSI, falso positivo em minúsculas e a invariante `temMarcador(comMarcador(x)) === false` para `x` sem `PRONTO`) em `test.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estruturas em memória e integração com eventos de terminal e shell integration do VS Code que sustentam as user stories.

**⚠️ CRITICAL**: Nenhuma user story pode ser concluída antes desta fase.

- [X] T003 Declarar em memória o mapa `terminaisFeature: Map<chave, Registro>` (com `chave` string no formato `` `${raiz}|${dir}|${idIA}` `` ou, para Specify de feature nova, `` `${raiz}|(nova)|${idIA}` ``; `term` do tipo `vscode.Terminal`; `ocupado` boolean `true` entre start e end de uma execução de shell nesse terminal; `abertoEm` number em ms só para `"nova"`) e o mapa `statusPasso: Map<dir, "andamento" | "concluido">` em `extension.js`
- [X] T004 Registrar em `activate()` o listener `window.onDidCloseTerminal` (remove de `terminaisFeature` o registro daquele `term`) e, via *feature detection*, `window.onDidStartTerminalShellExecution` e `window.onDidEndTerminalShellExecution` (atualizam `ocupado` do registro e leem `execution.read()` em fluxo para transicionar `statusPasso` de `"andamento"` para `"concluido"` e chamar `atualizar()` ao detectar `lib.temMarcador`) em `extension.js`

**Checkpoint**: Infraestrutura de rastreamento de terminais e leitura de marcador pronta.

---

## Phase 3: User Story 1 - Próximo passo continua no mesmo terminal (Priority: P1) 🎯 MVP

**Goal**: Reaproveitar o terminal aberto pelo painel para a mesma feature + IA nos próximos passos (enviando o comando à sessão ativa da IA ou relançando a IA no mesmo terminal se encerrada) e indicar visualmente `"em andamento"` / `"passo concluído"` no painel.

**Independent Test**: Com `sdd.reaproveitarTerminal` ligada, rodar Specify e depois Plan na mesma feature; deve existir apenas 1 terminal dessa feature contendo os dois passos, e o painel deve exibir `" · passo concluído"` em até 2 segundos após a IA escrever `PRONTO`.

### Implementation for User Story 1

- [X] T005 [US1] Ajustar `terminal(raiz, dir, comandos)` para retornar o `vscode.Terminal` criado (mantendo chamadores de manutenção como `instalarSpecKit`, instalar integração, `atualizarExtensao`, `sdd.abrirBranch` e `excluirFeature` fora de `terminaisFeature`, conforme FR-005) em `extension.js`
- [X] T006 [US1] Implementar função auxiliar de adoção e busca de terminal da feature (convertendo registro `"nova"` de `` `${raiz}|(nova)|${idIA}` `` em `` `${raiz}|${dir}|${idIA}` `` se `dir` não tem registro e `stat(D/spec.md).birthtimeMs >= abertoEm`, apagando o registro `"nova"` ao ser adotado ou substituindo-o em novo Specify) em `extension.js`
- [X] T007 [US1] Atualizar `rodar(raiz, dir, passo, args, antes, id)` para, quando o reaproveitamento estiver ativo, compor o prompt na ordem `promptOrquestrado(modo, comMarcador(prompt))`, atualizar `statusPasso` para `"andamento"`, trazer o terminal existente para a frente (`term.show()`) e: (a) se `term.shellIntegration` existir e `ocupado === true`, enviar `term.sendText(prompt, false)` e ~150 ms depois `term.sendText("\r", false)`; (b) se `term.shellIntegration` existir e `ocupado === false`, enviar `lib.juntar([...antes, lib.comandoAgente(a.exe, prompt, vscode.env.shell)], vscode.env.shell)` no mesmo terminal; (c) caso contrário, abrir novo terminal via `terminal()` e registrá-lo em `terminaisFeature` em `extension.js`
- [X] T008 [US1] Acrescentar o sufixo visual de `statusPasso` (`" · em andamento"` para `"andamento"` e `" · passo concluído"` para `"concluido"`) na `description` de `itemFeature(raiz, nome)` e no item `topo` de `Status.getChildren()` em `extension.js`

**Checkpoint**: User Story 1 funcional e testável de forma independente.

---

## Phase 4: User Story 2 - Ligar e desligar a opção (Priority: P2)

**Goal**: Disponibilizar a configuração global `sdd.reaproveitarTerminal` (desligada por padrão) nas configurações do editor, fazendo-a valer imediatamente no próximo passo sem recarregar a janela.

**Independent Test**: Alterar `sdd.reaproveitarTerminal` nas Settings do VS Code/Cursor e confirmar que o próximo passo respeita o novo valor imediatamente, sem recarregar a janela, e que desligada mantém o comportamento original.

### Implementation for User Story 2

- [X] T009 [P] [US2] Declarar a propriedade `"sdd.reaproveitarTerminal"` (`"type": "boolean"`, `"default": false`, `"description": "Roda o próximo passo da feature no mesmo terminal (e na mesma sessão da IA, se ela ainda estiver aberta). Precisa de shell integration (PowerShell, bash, zsh); no cmd.exe abre terminal novo."`) em `contributes.configuration.properties` de `package.json`
- [X] T010 [US2] Ler `vscode.workspace.getConfiguration("sdd").get("reaproveitarTerminal", false)` a cada passo em `rodar()` e ao renderizar `itemFeature()`/`Status.getChildren()` (ocultando o sufixo de status quando desligada e atualizando as views em `onDidChangeConfiguration` quando `sdd.reaproveitarTerminal` mudar) em `extension.js`

**Checkpoint**: User Stories 1 e 2 completas e independentemente verificáveis.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentação e validação final da feature.

- [X] T011 [P] Documentar a opção `sdd.reaproveitarTerminal` na lista da seção `## Configuração` em `README.md`
- [X] T012 Executar `npm test` para validar `test.js` e revisar os cenários manuais descritos em `specs/001-fechar-terminais/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente (`lib.js` e `test.js`).
- **Foundational (Phase 2)**: Depende de `comMarcador`/`temMarcador` da Phase 1 — bloqueia as User Stories em `extension.js`.
- **User Story 1 (Phase 3)**: Depende da conclusão da Phase 2.
- **User Story 2 (Phase 4)**: `T009` (`package.json`) pode rodar em paralelo desde o início; `T010` (`extension.js`) integra com a lógica de `rodar()` e das views criada na Phase 3.
- **Polish (Phase 5)**: Depende da conclusão das User Stories 1 e 2.

### User Story Dependencies

- **User Story 1 (P1)**: Começa logo após a Phase 2; entrega o reaproveitamento de terminal e o indicador de conclusão do passo.
- **User Story 2 (P2)**: Expõe a chave em `package.json` e garante a alternância dinâmica em tempo de execução sem recarregar a janela.

### Parallel Opportunities

- `T001` (`lib.js`), `T002` (`test.js`), `T009` (`package.json`) e `T011` (`README.md`) tocam em arquivos distintos e podem ser desenvolvidas em paralelo.
- As tarefas em `extension.js` (`T003` → `T004` → `T005` → `T006` → `T007` → `T008` → `T010`) modificam o mesmo arquivo e devem ser executadas em sequência.

---

## Parallel Example: User Story 1 & 2

```bash
# Tarefas em arquivos separados que podem ser executadas em paralelo:
Task T001: "Exportar as funções puras comMarcador(prompt) e temMarcador(texto) em lib.js"
Task T002: "Adicionar testes unitários para comMarcador e temMarcador em test.js"
Task T009: "Declarar a propriedade sdd.reaproveitarTerminal em package.json"
Task T011: "Documentar a opção sdd.reaproveitarTerminal em README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 + configuração básica)

1. Concluir Phase 1: `comMarcador` e `temMarcador` em `lib.js` + testes em `test.js` (`npm test` verde).
2. Concluir Phase 2: Mapas `terminaisFeature`/`statusPasso` e listeners de shell integration em `extension.js`.
3. Concluir Phase 3 (US1) e Phase 4 (US2): Reuso em `rodar()`, sufixo nas views e propriedade em `package.json`.
4. **STOP and VALIDATE**: Testar os cenários 1 a 4 e 9 do `quickstart.md`.

### Incremental Delivery

1. `lib.js` + `test.js` → funções puras testadas isoladamente.
2. `extension.js` + `package.json` → reaproveitamento de terminal e configuração dinâmica funcionando no editor.
3. `README.md` + validação completa do `quickstart.md`.
