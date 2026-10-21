# Contrato: site gerado e módulo `site.js`

## Pasta de saída `sdd-site/`

```text
sdd-site/
├── .gerado-pelo-sdd          # marcador: só uma pasta com ele é apagada e regerada
├── index.html                # features + passo atual + link da constituição
├── constituicao.html         # .specify/memory/constitution.md (se existir)
├── nao-encontrado.html       # destino de links para .md inexistente; lê ?doc=
├── busca.js                  # window.SDD_BUSCA = [{ titulo, url, texto }, ...]
└── <feature>/<rel>.html      # um por .md; <rel> mantém subpastas e acentos
```

- Todo link entre páginas é relativo (funciona em `file://` e em qualquer host estático).
- Cada página é autossuficiente (CSS e menu embutidos) e só carrega `busca.js` por `<script src>`.
- Regerar apaga a pasta inteira antes; páginas de arquivos apagados deixam de existir.

## Módulo `site.js` (sem `vscode`)

```js
/**
 * @param {string} raiz  pasta do repositório
 * @param {(md: string) => Promise<string> | string} render  Markdown → HTML
 * @returns {Promise<Map<string, string>>}  caminho relativo a sdd-site/ → conteúdo do arquivo
 */
async function gerarSite(raiz, render)
```

- Só lê arquivos; quem grava em disco (e apaga a pasta antiga) é `extension.js`.
- Em `extension.js`: `render = (md) => vscode.commands.executeCommand("markdown.api.render", md)`.

## Comando do VS Code

| Id | Título | Onde | Efeito |
|---|---|---|---|
| `sdd.gerarSite` | SDD: Gerar site da documentação | título da view `sdd.features`, paleta | gera `sdd-site/` e abre `index.html` no navegador |

Erros mostrados com `showErrorMessage`: sem `specs/`, pasta `sdd-site/` existente sem marcador,
`markdown.api.render` indisponível, falha ao gravar. Em todos, o site anterior fica intacto: `site.js`
monta tudo em memória primeiro e só então `extension.js` apaga e grava.
