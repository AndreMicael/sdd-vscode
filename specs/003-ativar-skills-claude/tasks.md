---

description: "Task list for feature implementation: Ativar skills do Claude na caixa de ação"
---

# Tasks: Ativar skills do Claude na caixa de ação

**Input**: Design documents from `/specs/003-ativar-skills-claude/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Inclui testes `node --test` em `test.js` para o helper puro de decisão (research §6 / quickstart). Fluxos de modal/terminal ficam manuais no quickstart.md.

**Organization**: Tarefas por user story para implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: A qual user story a tarefa pertence (`[US1]`, `[US2]`, `[US3]`)
- Caminhos de arquivo exatos em todas as descrições

## Path Conventions

- Projeto único na raiz: `extension.js`, `lib.js`, `test.js`, `package.json`, `README.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extrair a regra de “quando aplica orquestração” para lógica pura testável (sem API VS Code).

- [X] T001 Exportar em `lib.js` o helper puro de decisão (ex.: `aplicaOrquestracao(id, passo, modo)` ou equivalente) com as regras de `data-model.md`: `aplica === true` somente se `id === "claude"` **e** `PASSOS_ORQ.includes(passo)` **e** (`modo === "orq"` ou `modo === "orq-lazy"`); `modo` ∈ `"desligada" | "orq" | "orq-lazy"`; incluir no `module.exports`
- [X] T002 [P] Adicionar em `test.js` asserts do helper (Claude+plan+`orq` → aplica; Claude+clarify+`orq` → não; Cursor+plan+`orq` → não; Claude+plan+`desligada` → não) e manter regressão de `promptOrquestrado` / `skillInstalada` / `PASSOS_ORQ`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Valor efetivo da caixa chega em `rodar()` no momento do envio — base de FR-004 e do edge case “executar logo após trocar o select”.

**⚠️ CRITICAL**: Nenhuma user story de ativação confiável começa antes desta fase.

- [X] T003 Incluir `orquestracao: el("orquestracao").value` na mensagem `postMessage({ tipo: "executar", ... })` do JS da webview em `extension.js` (junto de `passo`, `raiz`, `dir`, `args`, `agente`)
- [X] T004 Em `FormProvider.receber` / `rodar()` em `extension.js`: aceitar modo efetivo da mensagem (`m.orquestracao` quando presente e válido); se ausente (paleta/menus), ler `sdd.orquestracao` como hoje; ao receber `executar` com `orquestracao` da caixa, sincronizar `update("orquestracao", valor, ConfigurationTarget.Global)` **antes** da lógica de skill (sem alterar preferência no caminho “Rodar sem orquestração” — isso fica na US2)

**Checkpoint**: Modo da caixa no clique é o modo que `rodar()` usa.

---

## Phase 3: User Story 1 - Escolher uma skill e vê-la valer na execução (Priority: P1) 🎯 MVP

**Goal**: Com Claude + `/orq` ou `/orq-lazy`, passo elegível e skill instalada, a execução confirma na UI e envia o prompt com a invocação da skill; com orquestração desligada, não ativa skill.

**Independent Test**: Publicstart §1–3 e §9 — notificação + prompt com `/${modo}` (ou sem skill se desligada); troca imediata no select vale no próximo Executar.

### Implementation for User Story 1

- [X] T005 [US1] Em `rodar()` em `extension.js`: usar o helper de T001 com `(id, passo, modoEfetivo)`; se `aplica` e `skillInstalada(modo, homedir)`, chamar `showInformationMessage` confirmando a skill (`Aplicando /orq…` / `Aplicando /orq-lazy…` per FR-010) **imediatamente antes** de abrir/enviar o terminal, e compor `prompt = promptOrquestrado(modo, prompt)` (ordem com reaproveitamento: `promptOrquestrado(modo, comMarcador(...))` quando `reaproveitar` ativo); se `!aplica` ou modo `desligada`, não prefixar skill e não mostrar a confirmação de skill

**Checkpoint**: US1 funcional sozinha (skill instalada; sem mexer no fluxo pós-install).

---

## Phase 4: User Story 2 - Entender quando a skill se aplica (Priority: P2)

**Goal**: Skill ausente → instalar de `https://github.com/AndreMicael/orq-skill` ou seguir sem orquestração sem fingir ativação; pós-install pergunta “Rodar agora com skill” | “Depois”; “Rodar sem” não muda a preferência salva. Bloco Orquestração só com Claude (já na UI — não regredir).

**Independent Test**: Quickstart §4–8 — modal instalar/seguir; “Rodar sem” mantém select; pós-install Depois não roda; Rodar agora orquestra.

### Implementation for User Story 2

- [X] T006 [US2] Em `rodar()` em `extension.js`, no ramo skill ausente: manter modal Instalar | Rodar sem orquestração | cancelar; após `instalarOrq()` com sucesso, **novo** modal “Rodar agora com skill” | “Depois” (FR-007 / SC-006); “Rodar agora” segue com confirmação UI + `promptOrquestrado`; “Depois” `return` sem abrir/enviar o passo; cancelar/`Instalar` falho encerram sem ativação falsa
- [X] T007 [P] [US2] Em `extension.js`: (1) no caminho “Rodar sem orquestração”, executar sem prefixo de skill e **não** chamar `update` de `sdd.orquestracao` (FR-012; preferência permanece `"orq"` | `"orq-lazy"`); (2) ajustar a mensagem de sucesso de `instalarOrq()` para não contradizer “Rodar agora” (evitar só “valem nas próximas sessões” se o passo puder rodar na hora)

**Checkpoint**: US2 independente; US1 continua válida com skill já instalada.

---

## Phase 5: User Story 3 - Preferência lembrada entre usos (Priority: P3)

**Goal**: Claude + skill escolhidos permanecem ao reabrir a caixa / recarregar a janela; a skill salva é a ativada na próxima execução elegível (FR-008).

**Independent Test**: Quickstart §11 — recarregar, reabrir caixa, mesmos valores; Executar Plan ainda orquestra.

### Implementation for User Story 3

- [X] T008 [US3] Garantir em `extension.js` que `enviarEstado()` continua hidratando `agente` e `orquestracao` na webview, que o `change` do select ainda grava Global, e que o fallback de `rodar()` sem `m.orquestracao` (comandos da paleta) usa `sdd.orquestracao` — de modo que a preferência lembrada ative na execução após T003–T007

**Checkpoint**: US1–US3 coerentes com persistência Global existente (`package.json` já tem `sdd.orquestracao`; sem chave nova).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs e validação final.

- [X] T009 [P] Ajustar `README.md` **somente** se o texto atual contradisser o fluxo “Rodar agora com skill” / pós-install (plan.md)
- [X] T010 Executar `npm test` e percorrer os cenários de `specs/003-ativar-skills-claude/quickstart.md` (pelo menos §1–3, §6–9, §11)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — `lib.js` + `test.js`
- **Foundational (Phase 2)**: Depende de T001 (helper usado em `rodar`); bloqueia ativação confiável
- **User Story 1 (Phase 3)**: Depende da Phase 2
- **User Story 2 (Phase 4)**: Depende da Phase 2; ideal após T005 (mesmo `rodar()`, mesmos ramos)
- **User Story 3 (Phase 5)**: Depende de T003–T004; validação final após US1/US2
- **Polish (Phase 6)**: Após as stories desejadas

### User Story Dependencies

- **US1 (P1)**: Após Foundational — MVP (ativação + confirmação UI)
- **US2 (P2)**: Após Foundational — fluxos skill ausente / pós-install; não bloqueia demo da US1 se a skill já estiver instalada
- **US3 (P3)**: Persistência já parcialmente existente; T008 fecha regressão após o envio do modo na mensagem

### Within Each User Story

- Helper/testes (Phase 1) antes de wired em `rodar()`
- Mensagem webview + resolução de modo antes de confirmação/prefixo
- Fluxo “instalada” (US1) antes de refinar pós-install (US2), se for sequencial no mesmo arquivo

### Parallel Opportunities

- T001 (`lib.js`) e T002 (`test.js`) em paralelo após o contrato do helper
- T007 (textos / “Rodar sem”) pode preparar-se em paralelo conceitualmente com T006, mas ambos tocam `extension.js` — executar em sequência no mesmo arquivo
- T009 (`README.md`) em paralelo com implementação, desde que o fluxo final já esteja definido

---

## Parallel Example: User Story 1

```bash
# Após Phase 1+2:
Task T005: "Confirmação UI + promptOrquestrado com modo efetivo em extension.js"

# Em paralelo na Phase 1:
Task T001: "Helper aplicaOrquestracao em lib.js"
Task T002: "Asserts do helper em test.js"
```

---

## Parallel Example: User Story 2

```bash
# Sequencial no mesmo arquivo (extension.js):
Task T006: "Modal pós-install Rodar agora | Depois"
Task T007: "Rodar sem não altera preferência + texto instalarOrq"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: helper + testes
2. Phase 2: `orquestracao` na mensagem + modo efetivo em `rodar()`
3. Phase 3: confirmação UI + `promptOrquestrado`
4. **STOP**: validar quickstart §1–3 e §9 com skill já instalada
5. Demo

### Incremental Delivery

1. Setup + Foundational → modo da caixa chega em `rodar()`
2. US1 → ativação real + confirmação (MVP)
3. US2 → instalar / Rodar sem / Rodar agora | Depois
4. US3 → confirmar persistência entre sessões
5. Polish → `npm test` + quickstart

### Parallel Team Strategy

1. Dev A: T001 + T002 (`lib.js` / `test.js`)
2. Dev B: T003 (webview) enquanto A fecha testes
3. Um dev em `extension.js` para T004 → T005 → T006 → T007 → T008 (mesmo arquivo)

---

## Notes

- Sem arquivo de código novo; sem chave nova em `package.json`
- Origem de instalação fixa: `https://github.com/AndreMicael/orq-skill` (já em `instalarOrq`)
- Não usar `claude -p` (slash skills não expandem)
- Não redesenhar Spec Kit nem catálogo geral de skills
- `[P]` = arquivos distintos / sem dependência incompleta
- Commit após cada tarefa ou grupo lógico
)
