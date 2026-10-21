# Data Model: Página navegável dos documentos Markdown

Tudo vive em memória durante a geração; nada é persistido além do HTML em `sdd-site/`.

## Feature

| Campo | Origem | Regra |
|---|---|---|
| `nome` | pasta em `specs/` (`lib.listarFeatures`) | só pastas `^\d+-` |
| `passoAtual` | `lib.trilha(dir)` → item `atual` | um dos 7 passos (FR-010) |
| `documentos` | `Documento[]` | pode ser vazio → menu mostra "sem documentos" (FR-014) |

## Documento

| Campo | Exemplo | Regra |
|---|---|---|
| `origem` | `specs/002-criar-pagina-mds/contracts/site-gerado.md` | relativo à raiz, com `/` |
| `rel` | `contracts/site-gerado.md` | relativo à pasta da feature; vazio para a constituição |
| `destino` | `002-criar-pagina-mds/contracts/site-gerado.html` | relativo a `sdd-site/` |
| `titulo` | primeiro `# ` do arquivo, ou o nome do arquivo | escapado no HTML |
| `tipo` | chave de `wiki.PASSOS` (`specify`, `plan`, `tasks`…) ou `null` | ver research §6 |
| `markdown` | conteúdo lido em UTF-8 | não é alterado (FR-015) |

Busca de arquivos: recursiva dentro da pasta da feature, todos os `*.md` (FR-001, inclui `contracts/` e
`checklists/` em qualquer profundidade). A constituição é um `Documento` fora de features.

## Página

Derivada de um `Documento`: HTML completo com menu (todas as features e documentos), caixa de tipo
(se `tipo`), índice de títulos (`h2`–`h4`) e conteúdo convertido com links reescritos.

## Resultado de busca

Entrada de `busca.js`: `{ titulo, url, texto }`, um por `Documento`. Ver o contrato.
