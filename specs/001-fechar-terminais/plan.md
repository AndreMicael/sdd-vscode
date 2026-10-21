# Implementation Plan: Reaproveitar o terminal da feature entre passos

**Branch**: `001-fechar-terminais` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-fechar-terminais/spec.md`

## Summary

Nova opção `sdd.reaproveitarTerminal` (desligada por padrão). Ligada, `rodar()` procura o terminal que a extensão abriu para a mesma feature + IA. Se a IA ainda roda nele (sabido pela *shell integration* do VS Code), digita só o comando do passo na sessão; se a IA já saiu, roda `<ia> '<prompt>'` de novo no mesmo terminal; se não há terminal, abre um como hoje e registra. O prompt ganha um pedido para terminar com `PRONTO`; a extensão lê a saída do terminal e mostra "passo concluído" no painel. Sem shell integration, a opção se comporta como desligada (abre terminal novo) — nunca digita sem saber o que está rodando.

## Technical Context

**Language/Version**: JavaScript (CommonJS) no Node do VS Code; sem build

**Primary Dependencies**: API `vscode` (engines `^1.85.0`). Usa `onDidStartTerminalShellExecution` / `onDidEndTerminalShellExecution` / `execution.read()` (estáveis desde 1.93) por *feature detection*, sem subir o `engines`

**Storage**: Nenhum — mapas em memória (somem ao recarregar a janela, como a spec assume)

**Testing**: `node --test` (`test.js`) para as funções puras em `lib.js`; o fluxo de terminal é validado à mão ([quickstart.md](quickstart.md))

**Target Platform**: VS Code / Cursor desktop; shells PowerShell, pwsh, bash, zsh (cmd.exe não tem shell integration → fallback)

**Project Type**: Extensão VS Code (`extension.js` + `lib.js`)

**Performance Goals**: "passo concluído" em até 2 s após `PRONTO` aparecer (SC-005) — leitura em fluxo, sem polling

**Constraints**: Nunca enviar texto a terminal que a extensão não abriu para aquela feature (FR-005); nunca fechar terminal; opção desligada = caminho atual intacto (SC-003)

**Scale/Scope**: Mudança em `rodar()`/`terminal()`, 2 funções novas em `lib.js`, 1 configuração no `package.json`, sufixo de status em 2 itens de view

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o modelo sem preencher: não há princípios ratificados, logo nenhum gate a violar. Seguimos as convenções do repositório: lógica pura em `lib.js` com teste em `test.js`, configurações `sdd.*` lidas a cada uso, textos em português.

**Pós-design**: continua sem violações. Nenhuma dependência nova, nenhum arquivo de código novo.

## Project Structure

### Documentation (this feature)

```text
specs/001-fechar-terminais/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── configuracao-e-marcador.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
extension.js   # rodar(), terminal(): registro/reuso; listeners de shell integration e onDidCloseTerminal; sufixo de status em itemFeature() e Status
lib.js         # comMarcador(prompt), temMarcador(texto) — puras, testáveis
test.js        # testes de comMarcador/temMarcador
package.json   # contributes.configuration: sdd.reaproveitarTerminal
README.md      # uma linha sobre a opção
```

**Structure Decision**: Projeto único; mantém a divisão atual — código que fala com o VS Code em `extension.js`, lógica pura em `lib.js`.

## Riscos

- Sem shell integration (cmd.exe, VS Code < 1.93, integração desligada pela pessoa) a opção não tem efeito. Documentado na descrição da configuração.
- `PRONTO` pode dar falso positivo ou faltar; aceito pela spec (só visual).
- Envio para a TUI da IA depende de o Enter separado ser aceito por cada CLI (Claude, Codex, Cursor, OpenCode, agy); validar no cenário 2 do quickstart com cada uma.

## Complexity Tracking

Sem violações.
