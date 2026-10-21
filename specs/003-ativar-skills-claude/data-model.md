# Data Model: Ativar skills do Claude na caixa de ação

Persistência só via configurações VS Code (já existentes). Estado de UI na webview; decisão de ativação em `rodar()`.

## Preferência de IA

| Campo | Tipo | Onde | Descrição |
|---|---|---|---|
| agente | `"claude" \| "cursor" \| "codex" \| "opencode" \| "agy"` | `sdd.agente` (Global) | IA selecionada na caixa |

## Preferência de orquestração

| Campo | Tipo | Onde | Descrição |
|---|---|---|---|
| orquestracao | `"desligada" \| "orq" \| "orq-lazy"` | `sdd.orquestracao` (Global) | Skill de orquestração escolhida; só faz sentido com Claude |

**Regras**
- Alterar o select na caixa grava Global (como hoje).
- Execução elegível usa o valor **efetivo no envio** (campo da mensagem da webview), não só o último valor lido da config.
- “Rodar sem orquestração” (skill ausente) **não** altera `sdd.orquestracao`.

## Skill no disco

| Campo | Tipo | Descrição |
|---|---|---|
| caminho | path | `~/.claude/skills/{orq\|orq-lazy}/SKILL.md` |
| instalada | boolean | `skillInstalada(nome, home)` |

Instalação copia diretórios de `https://github.com/AndreMicael/orq-skill` → `~/.claude/skills/`.

## Decisão de execução (efêmera)

Calculada em `rodar()` a cada passo; não persistida.

| Campo | Tipo | Descrição |
|---|---|---|
| id | string | IA da chamada (`m.agente` ou `agenteConfig()`) |
| passo | string | specify, plan, … |
| modo | `"desligada" \| "orq" \| "orq-lazy"` | Valor efetivo (mensagem ou config) |
| aplica | boolean | `id === "claude" && PASSOS_ORQ.includes(passo) && (modo === "orq" \|\| modo === "orq-lazy")` |
| promptFinal | string | `invocacao` (+ `comMarcador` se reaproveitar) (+ `promptOrquestrado` se aplica e instalada e usuário não pulou) |

### Transições do fluxo “skill ausente”

```text
aplica && !instalada
  → modal: Instalar | Rodar sem orquestração | (cancelar)
       Instalar → instalarOrq()
         falha → fim (erro); preferência intacta
         ok → modal: Rodar agora com skill | Depois
              Rodar agora → prompt orquestrado → terminal
              Depois → fim sem rodar; preferência intacta
       Rodar sem → prompt sem skill → terminal; preferência intacta
       cancelar → fim
aplica && instalada
  → confirmação UI → prompt orquestrado → terminal
!aplica
  → prompt sem skill → terminal
```
