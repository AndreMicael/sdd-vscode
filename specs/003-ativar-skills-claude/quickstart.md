# Quickstart: validar ativação das skills na caixa de ação

## Pré-requisitos

- Extensão desta branch instalada (`.vsix` ou F5).
- Repositório com Spec Kit + integração Claude.
- Claude Code no PATH (`claude`).
- Skills `/orq` e `/orq-lazy` instaláveis (rede + `git`); para cenários “já instalada”, use **SDD: Instalar skills de orquestração (/orq)** ou o fluxo do modal.

## Testes automáticos

```bash
npm test
```

Esperado: passam os testes atuais de `promptOrquestrado` / `skillInstalada` e o assert novo da decisão de modo/prompt (ver [contracts/orquestracao-ativacao.md](contracts/orquestracao-ativacao.md)).

## Cenários manuais

| # | Passos | Esperado | Cobre |
|---|---|---|---|
| 1 | Claude + `/orq`; skill instalada; Executar Plan | Notificação “aplicando /orq”; comando/prompt no terminal começa com `/orq` | US1-1, FR-010, SC-001, SC-007 |
| 2 | Trocar para `/orq-lazy`; Executar Plan de novo | Notificação e prompt com `/orq-lazy` (não `/orq`) | US1-2, US1-4, SC-003 |
| 3 | Orquestração desligada; mesmo Plan | Sem notificação de skill; prompt sem `/orq` nem `/orq-lazy` | US1-3, FR-003, SC-002 |
| 4 | IA = Cursor; olhar caixa | Bloco Orquestração oculto | US2-1, FR-005 |
| 5 | Claude + `/orq`; renomear/mover `~/.claude/skills/orq`; Executar Plan | Modal instalar ou seguir sem; sem fingir ativação | US2-2, FR-006, SC-004 |
| 6 | No modal, “Rodar sem orquestração” | Passo roda sem skill; select continua em `/orq` ao reabrir | FR-012 |
| 7 | No modal, Instalar → sucesso → “Depois” | Passo não roda; próxima execução elegível com `/orq` ativa a skill | US2-3, FR-007, SC-006 |
| 8 | Instalar → “Rodar agora com skill” | Passo segue com `/orq` no prompt + confirmação UI | FR-007 |
| 9 | Escolher `/orq` e clicar Executar imediatamente (sem esperar) | Ainda assim aplica `/orq` (valor da caixa no envio) | Edge FR-004 |
| 10 | Passo Clarify (não elegível) com `/orq` selecionado | Roda sem skill, sem erro | FR-009 |
| 11 | Recarregar janela; reabrir caixa | Claude + skill salvos; Executar Plan ainda orquestra | US3, FR-008 |
