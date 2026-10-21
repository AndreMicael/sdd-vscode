# Data Model: Reaproveitar o terminal da feature

Tudo em memória, dentro de `extension.js`. Nada é gravado em disco.

## Terminal da feature

Mapa `terminaisFeature: Map<chave, Registro>`.

| Campo | Tipo | Descrição |
|---|---|---|
| chave | string | `` `${raiz}|${dir}|${idIA}` ``; para Specify de feature nova, `` `${raiz}|(nova)|${idIA}` `` |
| term | `vscode.Terminal` | Terminal aberto por `terminal()` dentro de `rodar()` |
| ocupado | boolean | `true` entre start e end de uma execução de shell nesse terminal (IA ativa) |
| abertoEm | number (ms) | Só para "nova": quando o terminal foi aberto (regra de adoção) |

**Regras**
- Só `rodar()` cria registros. Terminais de manutenção (`instalarSpecKit`, instalar integração, `atualizarExtensao`, trocar branch) não entram (FR-005).
- `window.onDidCloseTerminal` → remove o registro desse `term`.
- Adoção: registro "nova" de `raiz|idIA` vira `raiz|D|idIA` se `D` não tem registro e `stat(D/spec.md).birthtimeMs >= abertoEm`. O "nova" é apagado ao ser adotado; um Specify novo substitui o "nova" anterior.
- Trocar de IA muda a chave → outro terminal (edge case da spec).

## Status do passo

Mapa `statusPasso: Map<dir, "andamento" | "concluido">`.

**Transições**
```text
(sem status) --passo enviado--> andamento
andamento    --"PRONTO" lido na saída do terminal da feature--> concluido
concluido    --novo passo enviado--> andamento
```
- Só é preenchido com a opção ligada.
- Registro "nova" ainda sem `dir`: o status vai para o `dir` que adotar o terminal; antes disso não aparece.
