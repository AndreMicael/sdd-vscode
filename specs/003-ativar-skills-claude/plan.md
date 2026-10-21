# Implementation Plan: Ativar skills do Claude na caixa de ação

**Branch**: `003-ativar-skills-claude` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-ativar-skills-claude/spec.md`

## Summary

A caixa já mostra `/orq` e `/orq-lazy`, mas a execução pode ignorar a escolha (modo lido só da config assíncrona) e falta a confirmação/fluxo pós-install da spec. Fechar o gap: enviar `orquestracao` no `executar`, aplicar `promptOrquestrado` com o valor efetivo, confirmar na UI, e após instalar perguntar “Rodar agora com skill” | “Depois” — sem mudar a preferência em “Rodar sem orquestração”.

## Technical Context

**Language/Version**: JavaScript (CommonJS) no Node do VS Code; sem build

**Primary Dependencies**: API `vscode` (engines `^1.85.0`); Claude Code CLI interativo (`claude '<prompt>'`); `git` para clonar `AndreMicael/orq-skill`

**Storage**: Configurações Globais `sdd.agente` e `sdd.orquestracao`; skills em `~/.claude/skills/{orq,orq-lazy}/`

**Testing**: `node --test` (`test.js`) para helpers puros; fluxos de modal/terminal no [quickstart.md](quickstart.md)

**Target Platform**: VS Code / Cursor desktop; Claude Code com skills pessoais

**Project Type**: Extensão VS Code (`extension.js` + `lib.js` + webview embutida)

**Performance Goals**: Ativação na mesma execução do clique (sem passo “fantasma”); confirmação UI imediata ao enviar

**Constraints**: Só Claude + passos em `PASSOS_ORQ`; instalação só de `https://github.com/AndreMicael/orq-skill`; não usar `claude -p` (slash skills não expandem); não redesenhar Spec Kit nem catálogo geral de skills

**Scale/Scope**: Ajuste em `rodar()`, mensagens da webview, textos de modal; opcional 1 helper + testes em `lib.js`/`test.js`; sem arquivo de código novo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o modelo sem preencher: não há princípios ratificados, logo nenhum gate a violar. Seguimos as convenções do repositório: lógica pura em `lib.js` com teste em `test.js`, configurações `sdd.*` lidas/gravadas no padrão existente, textos em português.

**Pós-design**: continua sem violações. Nenhuma dependência nova; reutiliza `promptOrquestrado` / `instalarOrq` / seletor da caixa.

## Project Structure

### Documentation (this feature)

```text
specs/003-ativar-skills-claude/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── orquestracao-ativacao.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
extension.js   # rodar(): modo efetivo, confirmação UI, modal pós-install; FormProvider: mensagem executar com orquestracao; HTML/JS da caixa
lib.js         # PASSOS_ORQ, promptOrquestrado, skillInstalada (+ helper de decisão se extrair)
test.js        # testes do helper / regressão de promptOrquestrado
package.json   # sdd.orquestracao e sdd.instalarOrq já existem
README.md      # ajustar só se o texto atual contradisser o fluxo “Rodar agora”
```

**Structure Decision**: Projeto único; mesma divisão — VS Code em `extension.js`, puro em `lib.js`.

## Riscos

- Claude Code só expande `/skill` em sessão interativa; se alguém mudar o lançamento para `-p`, a feature quebra (documentado em research §2).
- Skill instalada com a TUI do Claude já aberta pode não ser vista até nova sessão — “Rodar agora” deve preferir lançar/reusar de forma que o prompt com `/orq` seja a primeira mensagem; validar no quickstart §7–8.
- Branch git local pode estar nomeada `003-claude-skills` enquanto o diretório Spec Kit é `003-ativar-skills-claude`; alinhar no implement se necessário.

## Complexity Tracking

Sem violações.
