# Implementation Plan: Página navegável dos documentos Markdown

**Branch**: `002-criar-pagina-mds` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-criar-pagina-mds/spec.md`

## Summary

Um comando novo do painel SDD (`SDD: Gerar site da documentação`) lê todos os `.md` de `specs/` e a
constituição, converte cada um em uma página HTML estática e grava tudo em `sdd-site/` na raiz do
repositório, apagando a geração anterior. O site abre por `file://`, sem servidor: menu lateral
feature > arquivo, página inicial com o passo atual de cada feature, explicação do tipo de arquivo
(tirada de `wiki.js`), índice de títulos, links relativos reescritos e busca com índice embutido em JS.
O Markdown é convertido pelo renderizador que já vem no VS Code (`markdown.api.render`), sem
dependência nova.

## Technical Context

**Language/Version**: JavaScript (Node do VS Code), CommonJS com `// @ts-check`, como `lib.js`/`extension.js`

**Primary Dependencies**: nenhuma nova. API do VS Code (`markdown.api.render`, `env.openExternal`); `fs`/`path` do Node; textos de `wiki.js`; `lib.listarFeatures` e `lib.trilha`

**Storage**: arquivos — leitura de `specs/**/*.md` e `.specify/memory/constitution.md`; escrita em `sdd-site/`

**Testing**: `node --test` em `test.js`, com um renderizador falso injetado (o módulo novo não importa `vscode`)

**Target Platform**: extensão VS Code/Cursor (^1.85) para gerar; qualquer navegador para ler, via `file://`

**Project Type**: extensão VS Code (arquivo único na raiz, sem build)

**Performance Goals**: gerar o site de um repositório com dezenas de features em poucos segundos; não há meta mais fina

**Constraints**: sem servidor (nada de `fetch` entre páginas); sem dependência npm; somente leitura dos `.md`; nomes com acento

**Scale/Scope**: dezenas de features, centenas de `.md`; um `tasks.md` com centenas de tarefas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o modelo vazio do Spec Kit (só placeholders), então não há
princípio para violar. **Gate: PASS (sem regras definidas).** Seguimos as convenções que o repositório
já tem: lógica pura em módulo testável sem `vscode`, testes em `test.js`, sem dependências.

Recheck pós-design: **PASS** — o design adiciona um módulo puro (`site.js`), um comando e testes em
`test.js`; nada que exija justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/002-criar-pagina-mds/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── site-gerado.md   # estrutura de pastas, endereços e índice de busca do site
└── tasks.md             # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
site.js         # NOVO: lista os .md, monta o HTML de cada página, índice e busca (puro, sem vscode)
extension.js    # comando sdd.gerarSite: chama site.js com markdown.api.render, grava e abre no navegador
package.json    # contributes.commands + botão no título da view sdd.features
lib.js          # recebe esc() de extension.js, para site.js reaproveitar
test.js         # testes de site.js com renderizador falso
.vscodeignore   # + sdd-site/** (não empacotar o site gerado)
README.md       # como gerar o site e o risco do HTML cru
```

**Structure Decision**: o repositório é uma extensão de arquivos soltos na raiz (`extension.js`, `lib.js`,
`wiki.js`). Seguimos o mesmo padrão: a parte testável fica em `site.js` (como `lib.js`) e a parte que
depende do VS Code fica em `extension.js`.

## Complexity Tracking

Sem violações.
