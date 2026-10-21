# Quickstart: validar o reaproveitamento de terminal

## Pré-requisitos

- VS Code ≥ 1.93 (ou Cursor equivalente), shell PowerShell/pwsh/bash com shell integration ligada (padrão).
- Repositório com Spec Kit e a integração da IA (ex.: Claude Code).
- Extensão desta branch instalada (`.vsix` gerado ou F5).

## Testes automáticos

```bash
npm test
```
Esperado: passam os testes de `comMarcador`/`temMarcador` (ver [contracts/configuracao-e-marcador.md](contracts/configuracao-e-marcador.md)) e os já existentes.

## Cenários manuais

| # | Passos | Esperado | Cobre |
|---|---|---|---|
| 1 | Opção desligada; rodar Plan duas vezes | 2 terminais, como hoje | US1-4, SC-003 |
| 2 | Ligar `sdd.reaproveitarTerminal` (sem recarregar); Nova feature (Specify) e, com a IA ainda aberta, Plan | 1 terminal; `/speckit-plan` entra na mesma conversa | US1-1, US2, FR-006, SC-004 |
| 3 | No terminal da feature, sair da IA (`/exit`); rodar Tasks | Mesmo terminal; a IA abre de novo com o passo | US1-2 |
| 4 | Fechar o terminal; rodar Analyze | Terminal novo, que passa a ser o da feature | US1-3 |
| 5 | Rodar um passo da feature B | Terminal próprio de B; nada é digitado no de A | Edge, SC-002 |
| 6 | Trocar `sdd.agente` para Codex com Claude aberto; rodar passo | Terminal novo para Codex | Edge |
| 7 | Rodar passo enquanto a IA ainda responde | Pedido fica na fila da IA, sem interromper | Edge |
| 8 | Abrir um terminal próprio e "Instalar Spec Kit"; rodar passo | Nenhum dos dois recebe o passo | FR-005 |
| 9 | Esperar a IA terminar um passo | Painel mostra "passo concluído" em ≤ 2 s; novo passo volta a "em andamento" | FR-007, SC-005 |
| 10 | Rodar 5 passos seguidos | Exatamente 1 terminal da feature | SC-001 |
| 11 | Shell padrão = cmd.exe, opção ligada | Cada passo abre terminal novo (fallback) | Research §1 |
