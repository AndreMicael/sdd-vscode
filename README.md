# SDD (Spec Kit) para VS Code e Cursor

Painel lateral **SDD** para trabalhar com Spec-Driven Development (GitHub Spec Kit) sem decorar
comandos: mostra em que passo cada feature está, explica cada passo e chama a IA escolhida.

## Instalar

1. Baixe o `sdd-speckit-X.Y.Z.vsix` da última **Release** deste repositório
   (ou: `gh release download -R Desenvolve-MT/sdd-vscode -p "*.vsix"`).
2. Instale:
   - Cursor: `cursor --install-extension sdd-speckit-X.Y.Z.vsix`
   - VS Code: `code --install-extension sdd-speckit-X.Y.Z.vsix`
   - ou pela interface: Extensões → `…` → **Install from VSIX…**
3. Recarregue a janela (Ctrl+Shift+P → *Developer: Reload Window*) e abra o ícone **SDD** na barra lateral.

Para atualizar, instale o `.vsix` da versão nova do mesmo jeito (não há atualização automática).

### Pré-requisitos

- **Spec Kit CLI** (`specify`): `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
- **Pelo menos uma IA de terminal**, conforme a escolhida no painel:

  | IA | Comando que precisa existir |
  |---|---|
  | Claude Code | `claude` |
  | Cursor | `agent` (Cursor CLI) |
  | Codex (GPT) | `codex` |
  | OpenCode | `opencode` |
  | Antigravity | `agy` |

- Git. Os comandos rodam no terminal padrão do editor (PowerShell, cmd ou bash).

## O que tem no painel

- **Onde estou** — checklist dos 7 passos da feature da branch atual
  (Especificar → Esclarecer → Planejar → Tarefas → Conferir → Implementar → Fechar),
  com “← você está aqui”. Clicar num passo feito abre o arquivo; nos outros, abre o formulário do passo.
- **Features** — um nó por repositório aberto (a pasta aberta ou as subpastas diretas) e as features
  de `specs/` com a etapa de cada uma.
  - **+** no repositório: nova feature. **▶**: próximo passo. **📖**: wiki da feature.
  - **Botão direito** na feature: Wiki, Clarify, Checklist, Plan, Tasks, Analyze, Implement, Converge,
    Enviar ao ClickUp.
  - Repositório sem Spec Kit aparece com aviso e botão para instalar (`specify init --here`;
    a constituição existente é preservada).
- **Ação** — formulário com o seletor de **IA**, a descrição da nova feature e as instruções extras
  de cada passo.
- **Wiki da feature** — página com o passo atual, a explicação de cada passo (o que gera, quando usar,
  dicas, erros comuns), as tarefas do `tasks.md`, os arquivos da feature e um glossário.
  Os textos ficam em `wiki.js`.

Cada comando abre um terminal no repositório com `SPECIFY_FEATURE_DIRECTORY` apontando para a feature
e chama a IA com o comando do Spec Kit (`/speckit-plan`, `$speckit-plan` no Codex, `/speckit.plan`
no OpenCode). Se a integração dessa IA ainda não estiver no repositório, a extensão oferece
instalar (`specify integration install <ia> --script ps --force`). A lógica do SDD continua nas
skills do Spec Kit; a extensão só organiza e chama.

## Configuração

- `sdd.agente`: IA padrão (`claude`, `cursor`, `codex`, `opencode`, `agy`). O seletor do painel grava aqui.
- `sdd.listaClickUp`: lista sugerida em “Enviar ao ClickUp” (só Claude Code e Cursor têm essa skill).

## Desenvolver e publicar uma versão

```powershell
npm test
# suba "version" no package.json
npx @vscode/vsce package --allow-missing-repository
cursor --install-extension sdd-speckit-X.Y.Z.vsix   # testar localmente
git commit -am "..." ; git tag vX.Y.Z ; git push --follow-tags
gh release create vX.Y.Z sdd-speckit-X.Y.Z.vsix --generate-notes
```

O `.vsix` não vai para o git (está no `.gitignore`); ele é distribuído pela Release.
