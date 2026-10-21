---
description: "Task list for feature implementation: Página navegável dos documentos Markdown"
---

# Tasks: Página navegável dos documentos Markdown

**Input**: Design documents from `/specs/002-criar-pagina-mds/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/site-gerado.md`, `quickstart.md`

**Tests**: o plano pede testes de `site.js` em `test.js` (`node --test`) com um renderizador falso; o comando do VS Code é validado à mão pelo `quickstart.md`.

**Regras gerais**: sem dependência npm nova; `site.js` não importa `vscode`; `gerarSite` só lê arquivos e devolve um `Map` (caminho relativo a `sdd-site/` → conteúdo); quem apaga e grava é `extension.js`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história do `spec.md` (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Deixar o helper de escape acessível ao módulo puro e tirar o site gerado do pacote.

- [X] T001 Mover a função `esc(s)` de `extension.js` (linha ~535) para `lib.js`, exportá-la em `module.exports` e trocar os usos em `extension.js` por `lib.esc` (ou desestruturar no `require`), sem mudar o comportamento.
- [X] T002 [P] Acrescentar `sdd-site/**` em `.vscodeignore` para o site gerado não entrar no `.vsix`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Listar os documentos e montar a casca de página (menu + CSS) que todas as histórias usam.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase.

- [X] T003 Criar `site.js` (CommonJS, `// @ts-check`, sem `vscode`) com `listarDocumentos(raiz)`: para cada feature de `lib.listarFeatures(raiz)` (só pastas `^\d+-`), busca recursiva de todos os `*.md` na pasta da feature (inclui `contracts/` e `checklists/` em qualquer profundidade), devolvendo `{ nome, passoAtual, documentos }`; cada `Documento` tem `origem` ("relativo à raiz, com `/`"), `rel` ("relativo à pasta da feature; vazio para a constituição"), `destino` (`<feature>/<rel>` com `.md` → `.html`), `titulo` ("primeiro `# ` do arquivo, ou o nome do arquivo"), `markdown` (UTF-8, não alterado) e `tipo` (por ora `null`). `passoAtual` = título do item com `estado === "atual"` de `lib.trilha(dir)`. A constituição `.specify/memory/constitution.md`, se existir, vira um `Documento` à parte com `destino` `constituicao.html`.
- [X] T004 Em `site.js`, criar `href(deDestino, paraDestino)` que gera link relativo entre dois `destino`s aplicando `encodeURIComponent` em cada segmento (mantém acentos no nome do arquivo, escapa `#`, `?`, `&`), e `pagina({ titulo, menu, corpo, raizRel })` que devolve um HTML completo (`<meta charset="utf-8">`, CSS embutido, menu lateral, `<main>`), com títulos e nomes passados por `lib.esc`.
- [X] T005 Em `site.js`, criar `menu(features, constituicao, destinoAtual)`: lista hierárquica feature > arquivo (texto do item = `rel`), item próprio para a constituição e link para `index.html`; feature com `documentos` vazio mostra "sem documentos" e continua no menu (FR-014); links relativos ao `destinoAtual` via `href`.
- [X] T006 Em `test.js`, acrescentar testes de `listarDocumentos` e `href` numa pasta temporária (`fs.mkdtempSync`) com duas features, um `.md` em `contracts/`, um nome com acento (`anotação.md`) e uma feature vazia: confere `rel`, `destino`, `titulo`, feature vazia presente e `href` com segmento codificado.

**Checkpoint**: documentos listados e casca de página pronta.

---

## Phase 3: User Story 1 - Navegar e ler os documentos das features (Priority: P1) 🎯 MVP

**Goal**: gerar `sdd-site/` com página inicial, uma página por `.md`, constituição e menu, a partir de um botão do painel.

**Independent Test**: no painel SDD, "Gerar site da documentação"; o navegador abre `sdd-site/index.html` com as features e o passo atual; abrir `001-fechar-terminais` > `contracts/configuracao-e-marcador.md` mostra tabelas, listas e checkboxes formatados em endereço próprio (quickstart cenários 1–2).

### Tests for User Story 1

- [X] T007 [US1] Em `test.js`, testar `gerarSite(raiz, render)` com renderizador falso (ex.: devolve `<h1>…</h1><ul><li>[ ] a</li><li>[x] b</li><li>[X] c</li></ul>`): o `Map` tem `index.html`, `constituicao.html`, `.gerado-pelo-sdd` e uma entrada por `.md`; `index.html` cita cada feature e seu passo atual; `<li>[ ]`/`<li>[x]`/`<li>[X]` viram `<input type="checkbox" disabled>` (marcado nos dois últimos).

### Implementation for User Story 1

- [X] T008 [US1] Em `site.js`, implementar e exportar `async gerarSite(raiz, render)` conforme `contracts/site-gerado.md`: chama `listarDocumentos`, para cada documento faz `await render(markdown)`, troca `<li>[ ]`/`<li>[x]`/`<li>[X]` por checkbox desabilitado com regex, envolve em `pagina` + `menu` e grava no `Map` em `destino`; inclui `constituicao.html` (se existir), `.gerado-pelo-sdd` (conteúdo curto) e `index.html` com a lista de features, o passo atual de cada uma (um dos 7 passos) e o link da constituição. Lança `Error` se não houver `specs/`.
- [X] T009 [US1] Em `extension.js`, registrar `sdd.gerarSite`: escolhe o repositório (com vários, `showQuickPick` como os comandos existentes); `render = (md) => vscode.commands.executeCommand("markdown.api.render", md)` — se falhar, erro e para; chama `site.gerarSite` (tudo em memória primeiro); só então, se `sdd-site/` existir **sem** `.gerado-pelo-sdd`, `showErrorMessage` e não apaga; senão `fs.rmSync(pasta, { recursive: true, force: true })`, grava cada entrada (criando subpastas, UTF-8) e chama `vscode.env.openExternal(vscode.Uri.file(<raiz>/sdd-site/index.html))`. Erros de gravação vão para `showErrorMessage`.
- [X] T010 [P] [US1] Em `package.json`, acrescentar em `contributes.commands` `{ "command": "sdd.gerarSite", "title": "SDD: Gerar site da documentação", "icon": "$(globe)" }` e em `menus.view/title` `{ "command": "sdd.gerarSite", "when": "view == sdd.features", "group": "navigation@4" }`.

**Checkpoint**: site navegável gerado e aberto pelo painel (MVP).

---

## Phase 4: User Story 2 - Entender os tipos de arquivo e seguir referências (Priority: P2)

**Goal**: caixa de explicação por tipo, índice de títulos e links relativos entre `.md` reescritos (com página de "não encontrado").

**Independent Test**: abrir `spec.md` e ver a caixa (o que é, passo que gera, quando ler) e o índice; um link `[x](plan.md)` abre o plano e `[y](nao-existe.md)` abre "documento não encontrado" com o caminho (quickstart cenários 3–4).

### Tests for User Story 2

- [X] T011 [US2] Em `test.js`, testar: `tipoDoDocumento` dá tipo para os 7 arquivos conhecidos (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`) e para `contracts/x.md`, e `null` para `notas.md`; `reescreverLinks` troca `href="plan.md#sec"` existente por `.html#sec` relativo, `href="../outra/spec.md"` resolvido a partir da pasta de origem, link inexistente por `nao-encontrado.html?doc=…`, e não toca `http…`, não-`.md` nem `data-href`; `indice` dá `id` com sufixo `-2` em títulos repetidos.

### Implementation for User Story 2

- [X] T012 [US2] Em `site.js`, criar `tipoDoDocumento(rel)` que percorre `wiki.PASSOS` e devolve a chave do passo cujo item de `gera` começa por `rel` (ex.: `"checklists/requirements.md (validação…)"`) ou pela pasta (`"contracts/ (APIs)"` casa com `contracts/…`); sem correspondência → `null` (FR-009). Preencher `tipo` em `listarDocumentos` e, em `gerarSite`, quando houver tipo, mostrar caixa com `resumo` (o que é), o título/comando do passo (quem gera) e `quando`, tudo escapado.
- [X] T013 [US2] Em `site.js`, criar `reescreverLinks(html, doc, destinos)`: regex sobre ` href="…"` (com espaço antes, para ignorar `data-href`) relativos terminados em `.md` (com ou sem `#âncora`, decodificando `%xx`); resolve com `path.posix` a partir da pasta da `origem`; se o destino está em `destinos`, troca por link `.html` relativo (via `href`) mantendo a âncora; senão aponta para `nao-encontrado.html?doc=<caminho codificado>` relativo. Links externos e não-`.md` ficam como estão. Aplicar em `gerarSite`.
- [X] T014 [US2] Em `site.js`, criar `indice(html)`: percorre `<h2>`–`<h4>` com regex, dá `id` (slug do texto sem tags, sufixo `-2`, `-3` em repetidos) quando não houver, e devolve `{ html, toc }` com a lista de links `#id` exibida ao lado do conteúdo; `h1` fica fora. Aplicar em `gerarSite`.
- [X] T015 [US2] Em `site.js`, gerar `nao-encontrado.html` com o menu e um script inline que lê `new URLSearchParams(location.search).get("doc")` e mostra "Documento não encontrado: <caminho>" via `textContent` (sem `innerHTML`).

**Checkpoint**: US1 e US2 funcionando.

---

## Phase 5: User Story 3 - Encontrar conteúdo por busca (Priority: P3)

**Goal**: caixa de busca no menu que filtra todos os documentos, funcionando em `file://`.

**Independent Test**: buscar "terminal" lista páginas da feature 001 que abrem ao clicar; "codigo" acha "código"; "zzzz" mostra "Nenhum documento encontrado" (quickstart cenário 5).

### Tests for User Story 3

- [X] T016 [US3] Em `test.js`, testar que `gerarSite` produz `busca.js` começando com `window.SDD_BUSCA =`, com uma entrada `{ titulo, url, texto }` por documento e `texto` em minúsculas e sem acento (`"código"` → contém `"codigo"`).

### Implementation for User Story 3

- [X] T017 [US3] Em `site.js`, gerar `busca.js` = `window.SDD_BUSCA = <JSON>;` com `{ titulo, url: destino, texto }` por documento (inclui constituição); `texto` = Markdown sem marcação simples, `toLowerCase()` e `normalize("NFD").replace(/[̀-ͯ]/g, "")`. Comentário: `shortcut: busca linear por substring, trocar por índice invertido se passar de alguns MB`.
- [X] T018 [US3] Em `site.js` (`pagina`), incluir no topo do menu um `<input type="search" aria-label="Buscar">`, `<script src="<raizRel>busca.js">` e um script inline que normaliza o termo do mesmo jeito, filtra `SDD_BUSCA` por `includes`, lista títulos com link (`raizRel + url` codificado) criados com `textContent`, e mostra "Nenhum documento encontrado" quando vazio.

**Checkpoint**: as três histórias funcionando.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Em `README.md`, documentar em poucas linhas o comando "SDD: Gerar site da documentação", a pasta `sdd-site/` (o marcador `.gerado-pelo-sdd`; versionar ou não é decisão do time) e o risco aceito de HTML cru dos `.md` rodar no site (research §10).
- [ ] T020 Rodar `npm test` e todos os cenários de `quickstart.md` (1–9), desfazendo os arquivos de teste dos passos 4, 7 e 8 ao terminar.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende de T001 (`lib.esc`). Bloqueia as histórias.
- **US1 (Phase 3)**: depende da Phase 2.
- **US2 (Phase 4)** e **US3 (Phase 5)**: dependem de T008 (`gerarSite`), pois alteram a mesma montagem de página; testáveis separadamente.
- **Polish (Phase 6)**: depois das histórias desejadas.

### Within Each User Story

- Teste escrito antes e falhando; depois a implementação em `site.js`; `extension.js`/`package.json` por último.
- Quase tudo está em `site.js` e `test.js`: tarefas no mesmo arquivo são sequenciais.

### Parallel Opportunities

- T002 em paralelo com T001.
- T010 (`package.json`) em paralelo com T008/T009.
- T019 (`README.md`) em paralelo com qualquer tarefa de código.
- US2 e US3 tocam o mesmo `site.js`: em sequência, não em paralelo.

---

## Parallel Example: User Story 1

```text
Task: "T009 Registrar sdd.gerarSite em extension.js"
Task: "T010 Acrescentar comando e botão em package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1).
3. **Parar e validar**: `npm test` e quickstart cenários 1–2.

### Incremental Delivery

1. Setup + Foundational → documentos listados.
2. US1 → site navegável (MVP).
3. US2 → tipos, índice e links.
4. US3 → busca.

---

## Notes

- `site.js` monta tudo em memória; o site anterior só é apagado depois que a geração deu certo e o marcador foi conferido.
- Títulos, nomes de arquivo e textos de busca entram escapados; o HTML do renderizador é usado como está (risco aceito, research §10).
- Commit por tarefa ou grupo lógico.
