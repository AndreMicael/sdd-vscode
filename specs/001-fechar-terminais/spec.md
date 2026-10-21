# Feature Specification: Fechar terminais ao terminar o passo

**Feature Branch**: `001-fechar-terminais`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "quero uma opção que feche os terminais abertos automaticamente quando terminar o passo da feature"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Terminal do passo fecha sozinho (Priority: P1)

Quem usa o painel SDD roda um passo da feature (Specify, Plan, Tasks, Implement...). Cada passo abre um terminal novo com a IA. Depois de alguns passos, ficam vários terminais "SDD: ..." acumulados. Com a opção ligada, o terminal de um passo fecha sozinho quando esse passo termina, e a pessoa não precisa limpar à mão.

**Why this priority**: É o pedido em si; sem isso a feature não existe.

**Independent Test**: Ligar a opção, rodar um passo e verificar que o terminal daquele passo some quando o passo termina, sem tocar nos outros terminais.

**Acceptance Scenarios**:

1. **Given** a opção ligada, **When** um passo da feature termina, **Then** o terminal aberto pelo painel para esse passo é fechado automaticamente.
2. **Given** a opção desligada (padrão), **When** um passo termina, **Then** nada muda: o terminal continua aberto como hoje.
3. **Given** a opção ligada e um terminal aberto pela própria pessoa, **When** um passo termina, **Then** esse terminal não é fechado.

---

### User Story 2 - Ligar e desligar a opção (Priority: P2)

A pessoa liga ou desliga o fechamento automático nas configurações da extensão, no mesmo lugar das outras opções do SDD.

**Why this priority**: Sem um jeito de ligar, a P1 não pode ser usada; mas é um detalhe simples.

**Independent Test**: Alterar a opção e confirmar que o próximo passo respeita o novo valor, sem recarregar a janela.

**Acceptance Scenarios**:

1. **Given** a opção desligada, **When** a pessoa liga, **Then** o próximo passo rodado já fecha o terminal ao terminar.

---

### Edge Cases

- O passo falha ou a pessoa interrompe a IA: o terminal fica aberto, para a pessoa ver o erro.
- A pessoa já fechou o terminal à mão antes do passo terminar: nada acontece, sem erro.
- Terminais de manutenção abertos pelo painel (instalar Spec Kit, instalar integração, trocar de branch, atualizar extensão) não são "passo da feature" e seguem o comportamento atual.
- Dois passos de features diferentes rodando ao mesmo tempo: cada um fecha só o próprio terminal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A extensão MUST oferecer uma opção para fechar automaticamente o terminal de um passo da feature quando ele terminar, desligada por padrão.
- **FR-002**: O passo é considerado terminado quando [NEEDS CLARIFICATION: a IA fica aberta esperando a próxima mensagem depois de concluir — o gatilho é (A) o painel detectar que a feature avançou de etapa, (B) a pessoa sair da IA, ou (C) fechar os terminais anteriores ao abrir o próximo passo?]
- **FR-003**: A extensão MUST fechar apenas terminais que ela mesma abriu para rodar passos da feature; terminais da pessoa ou de outras extensões nunca são fechados.
- **FR-004**: A extensão MUST NOT fechar o terminal quando o passo termina com erro ou é interrompido.
- **FR-005**: Mudar a opção MUST valer a partir do próximo passo, sem recarregar a janela.

### Key Entities

- **Terminal do passo**: terminal aberto pelo painel para rodar um passo de uma feature; ligado à feature e ao passo que o originou.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com a opção ligada, depois de rodar 5 passos seguidos fica no máximo 1 terminal do painel aberto (o do passo em andamento).
- **SC-002**: 0 terminais abertos pela pessoa são fechados pela extensão.
- **SC-003**: Com a opção desligada, o comportamento é idêntico ao atual.
- **SC-004**: Quando um passo falha, o terminal com o erro continua visível em 100% dos casos.

## Assumptions

- "Passo da feature" = comandos do Spec Kit rodados pelo painel (Specify, Clarify, Plan, Tasks, Analyze, Implement, Converge, Checklist), em qualquer IA suportada.
- A opção é por pessoa (configuração global do editor), igual às outras opções do SDD.
- Fora de escopo: fechar terminais antigos já abertos antes de a opção existir, ou fechar qualquer terminal que não seja do painel.
