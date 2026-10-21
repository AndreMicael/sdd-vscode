# Quickstart: validar o site da documentação

## Pré-requisitos

- Extensão instalada a partir desta branch (F5 no VS Code ou `.vsix`).
- Este repositório aberto: já tem `specs/001-fechar-terminais` (com `contracts/` e `checklists/`) e
  `specs/002-criar-pagina-mds`.

## Testes automáticos

```powershell
npm test
```

Esperado: os testes de `site.js` passam (lista de documentos, link reescrito, link quebrado, tipo do
documento, `id` dos títulos, checkbox).

## Cenários manuais

1. **Gerar** — no painel SDD, botão "Gerar site da documentação". Esperado: o navegador abre
   `sdd-site/index.html` com as duas features e o passo atual de cada uma (FR-010, FR-017).
2. **Menu e páginas** — abrir `001-fechar-terminais` > `contracts/configuracao-e-marcador.md`.
   Esperado: tabelas, listas e código formatados; endereço próprio na barra (FR-002–FR-004, SC-001).
3. **Tipo e índice** — abrir `spec.md`. Esperado: caixa explicando o que é, que vem do passo 1 e quando
   ler; índice de títulos à direita leva às seções (FR-007, FR-008).
4. **Links** — num `.md` qualquer, acrescentar `[x](plan.md)` e `[y](nao-existe.md)`, gerar de novo.
   Esperado: o primeiro abre o plano; o segundo abre "documento não encontrado" com o caminho (FR-005, FR-006).
5. **Busca** — buscar "terminal". Esperado: resultados da feature 001 que abrem a página; buscar
   "zzzz" mostra "Nenhum documento encontrado" (FR-011).
6. **Regerar** — apagar o `.md` de teste, gerar de novo. Esperado: a página dele some (FR-012, SC-006).
7. **Acentos** — criar `specs/001-fechar-terminais/anotação.md`, gerar. Esperado: aparece no menu como
   "anotação.md" e abre (FR-013, SC-007).
8. **Tipo desconhecido e feature vazia** — criar `specs/001-fechar-terminais/notas.md` e a pasta
   `specs/003-vazia/`, gerar. Esperado: `notas.md` abre sem caixa de tipo; `003-vazia` aparece no menu
   com "sem documentos" (FR-009, FR-014). Qualquer arquivo fica a 2 cliques do início (SC-002).
9. **Sem extensão** — copiar `sdd-site/` para outra pasta e abrir `index.html` com duplo clique.
   Esperado: menu, links e busca funcionam (SC-009).

Desfaça os arquivos de teste dos passos 4, 7 e 8 ao terminar.
