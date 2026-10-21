# Contrato: configuração e palavra-chave

## Configuração (`package.json` → `contributes.configuration.properties`)

```json
"sdd.reaproveitarTerminal": {
  "type": "boolean",
  "default": false,
  "description": "Roda o próximo passo da feature no mesmo terminal (e na mesma sessão da IA, se ela ainda estiver aberta). Precisa de shell integration (PowerShell, bash, zsh); no cmd.exe abre terminal novo."
}
```

- Escopo: global por pessoa, como as outras `sdd.*`.
- Lida a cada passo; mudar vale no próximo passo (FR-006).

## Funções em `lib.js`

| Função | Entrada | Saída |
|---|---|---|
| `comMarcador(prompt)` | prompt do passo | prompt + `" Ao terminar, escreva a palavra pronto em maiúsculas, sozinha, na última linha."` |
| `temMarcador(texto)` | pedaço da saída do terminal (pode ter ANSI) | `true` se, sem códigos ANSI, contém `PRONTO` como palavra inteira em maiúsculas |

- Ordem com a orquestração: `promptOrquestrado(modo, comMarcador(prompt))`.
- A frase acrescentada nunca contém `PRONTO` em maiúsculas, então `temMarcador(comMarcador(x))` é `false` para todo `x` sem `PRONTO`.

## Indicador no painel

- Descrição do item da feature e do topo de "Onde estou" ganham ` · em andamento` ou ` · passo concluído`.
- Com a opção desligada: nenhuma mudança visual.
