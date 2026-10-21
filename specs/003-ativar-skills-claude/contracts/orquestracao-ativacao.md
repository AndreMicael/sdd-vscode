# Contrato: ativação da skill de orquestração

## Configuração (`package.json` → `contributes.configuration.properties`)

Sem novas chaves. Continua:

```json
"sdd.orquestracao": {
  "type": "string",
  "enum": ["desligada", "orq", "orq-lazy"],
  "default": "desligada"
}
```

- Escopo: Global.
- UI da caixa só oferece o select quando IA = Claude.

## Mensagens webview → extensão

| tipo | Campos relevantes | Efeito |
|---|---|---|
| `orquestracao` | `valor` | `update("orquestracao", valor, Global)` |
| `executar` | `passo`, `raiz`, `dir`, `args`, `agente`, **`orquestracao`** | `rodar(..., agente)` com modo = `orquestracao` da mensagem |
| `criar` | …, `agente` (, `orquestracao` opcional) | Specify não é elegível; orquestração não aplica (FR-009) |

## Funções em `lib.js` (já existentes; contrato estável)

| Função | Contrato |
|---|---|
| `PASSOS_ORQ` | `["plan","tasks","analyze","implement","converge"]` |
| `promptOrquestrado(modo, prompt)` | Se `modo` é `orq` ou `orq-lazy`, retorna string que **começa com** `/${modo}` e inclui o `prompt` do passo; senão devolve `prompt` intacto |
| `skillInstalada(nome, home)` | `true` se existe `{home}/.claude/skills/{nome}/SKILL.md` |

Ordem com reaproveitamento de terminal (feature 001): `promptOrquestrado(modo, comMarcador(invocacao(...)))` quando ambos ativos.

## Confirmação na UI (FR-010)

Quando `aplica && instalada` (ou pós-install “Rodar agora”) e o prompt for orquestrado:

1. Notificação VS Code informando a skill (`/orq` ou `/orq-lazy`) que será aplicada.
2. Comando/prompt enviado ao terminal contém a invocação `/${modo}` (visível no eco do shell / TUI).

## Instalação

- Comando: `sdd.instalarOrq` e o botão “Instalar” do modal em `rodar()`.
- Origem exclusiva: `git clone --depth 1 https://github.com/AndreMicael/orq-skill` → cópia de `skills/*` para `~/.claude/skills/`.
