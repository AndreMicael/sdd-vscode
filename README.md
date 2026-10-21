# SDD (Spec Kit) para VS Code e Cursor

Painel lateral **SDD** com um nó por repositório git aberto (a pasta aberta ou as subpastas
diretas dela, ex.: abrir `renegocia-dmt/` mostra frontend e backend) e as features de `specs/` de cada um.

- **+ na linha do repositório**: nova feature naquele repositório. O **+ do topo** pergunta qual.
- Repositório **sem Spec Kit** aparece com aviso e um botão para instalar (`specify init --here`;
  a constituição que já existir é preservada).

- Cada feature mostra a etapa (spec pronta, plano pronto, tarefas 3/12, concluída) e a feature atual.
- **▶ (Próximo passo)** roda o comando certo para a etapa: plan → tasks → implement → converge.
- **Botão direito** na feature: Clarify, Checklist, Plan, Tasks, Analyze, Implement, Converge, Enviar ao ClickUp.
- **+ (Nova feature)**: pergunta o que construir, cria a branch `NNN-nome` (opcional) e roda `/speckit-specify`.
- Clicar num arquivo (spec.md, plan.md, tasks.md, checklists) abre o arquivo.

Os comandos abrem um terminal no repositório com `SPECIFY_FEATURE_DIRECTORY` apontando para a
feature e chamam `claude '/speckit-...'`. A extensão não tem lógica própria de SDD: tudo continua
nas skills do Spec Kit.

## Configuração

- `sdd.agente`: `claude` (padrão) ou `cursor` (CLI `agent`; antes rode
  `specify integration install cursor-agent` no repositório para os `/speckit-*` existirem lá).
- `sdd.listaClickUp`: lista sugerida em "Enviar ao ClickUp".

## Instalar / atualizar

```powershell
npm test
npx @vscode/vsce package --skip-license --allow-missing-repository
code --install-extension sdd-speckit-0.1.0.vsix
cursor --install-extension sdd-speckit-0.1.0.vsix
```
