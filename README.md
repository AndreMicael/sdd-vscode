# SDD (Spec Kit) para VS Code e Cursor

Painel lateral **SDD** para trabalhar com Spec-Driven Development (GitHub Spec Kit) sem decorar
comandos: mostra em que passo cada feature está, explica cada passo e chama a IA escolhida.

## Instalar

1. Baixe ou clone este repositorio e clique duas vezes em **instalar.cmd** (requer o `gh` logado com acesso a `Desenvolve-MT`).
   Para atualizar, clique no botao de nuvem no painel **Features** ou execute **SDD: Atualizar extensao**.

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
  - Features de outras branches (suas ou da equipe, apos Buscar features da equipe) aparecem com icone de nuvem/branch; botao direito > Abrir branch para trabalhar nelas.
  - **+** no repositório: nova feature. **▶**: próximo passo. **📖**: wiki da feature.
  - **Botão direito** na feature: Wiki, Clarify, Checklist, Plan, Tasks, Analyze, Implement, Converge,
    Enviar ao ClickUp, Excluir (pasta vai para a lixeira; branch opcional).
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
- `sdd.layout.colunas`: layout das webviews (`auto`, `1` ou `2`); `auto` usa duas colunas quando houver espaço.
- `sdd.layout.densidade`: espaçamento (`confortavel` ou `compacta`).

O botão de engrenagem **SDD: Layout do painel**, no título da view **Ação**, abre essas configurações diretamente.

### ClickUp (opcional)

Botão direito no repositório > **Vincular ClickUp** e cole o link da pasta/lista do projeto. Isso cria `.specify/clickup.json`; commite o arquivo para a equipe. **Abrir no ClickUp** leva ao workspace certo. Sem ClickUp vinculado, **Enviar ao ClickUp** não envia nada: basta commitar o código.

## Gerar o .vsix depois de alterar o projeto

Na pasta da extensão:

```powershell
cd D:\Workspaces\git-desenvolve\renegocia-dmt\sdd-vscode
npm test                                                     # 1. confere que nada quebrou
# 2. suba "version" no package.json (ex.: 0.7.0 → 0.7.1)
npx @vscode/vsce package --allow-missing-repository          # 3. gera sdd-speckit-0.7.1.vsix
cursor --install-extension sdd-speckit-0.7.1.vsix --force    # 4. instala no seu Cursor
```

Depois recarregue a janela (Ctrl+Shift+P → *Developer: Reload Window*) e teste.

- **Por que subir a versão:** o nome do arquivo sai da `version` do `package.json`. Sem mudar a
  versão, o pacote novo sobrescreve o antigo com o mesmo nome e fica difícil saber quem tem qual.
- **Formato:** correção → 0.7.1; recurso novo → 0.8.0.
- No VS Code, troque `cursor` por `code` no passo 4.

## Publicar a versão para o time

Depois de testar:

```powershell
git commit -am "..." ; git tag v0.7.1 ; git push --follow-tags
gh release create v0.7.1 sdd-speckit-0.7.1.vsix --generate-notes
```

Sem o `gh`: no GitHub, Releases → *Draft a new release* → escolha a tag e arraste o `.vsix`.

O `.vsix` não vai para o git (está no `.gitignore`); ele é distribuído pela Release.
