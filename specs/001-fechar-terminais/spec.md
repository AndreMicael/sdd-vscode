# Feature Specification: Reaproveitar o terminal da feature entre passos

**Feature Branch**: `001-fechar-terminais`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "quero uma opção que feche os terminais abertos automaticamente quando terminar o passo da feature"

**Clarificação**: a pessoa preferiu não fechar terminais: o próximo passo deve continuar no mesmo terminal do passo anterior.

## Clarifications

### Session 2026-10-21

- Q: Para o painel saber se o passo anterior terminou, a IA deve dizer uma palavra-chave no fim (ex.: "pronto")? → A: Sim, mas só para mostrar "passo concluído" no painel; não muda nada no envio dos passos (pedido durante uma resposta continua indo para a fila).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Próximo passo continua no mesmo terminal (Priority: P1)

Quem usa o painel SDD roda os passos de uma feature em sequência (Specify, Plan, Tasks, Implement...). Hoje cada passo abre um terminal novo e eles se acumulam. Com a opção ligada, o painel manda o próximo passo para o terminal que já existe para aquela feature. Se a IA ainda está aberta nele, o passo entra na mesma conversa. Se a IA já foi encerrada, ela é iniciada de novo nesse mesmo terminal.

**Why this priority**: É o pedido em si. Acaba com o acúmulo de terminais e mantém o contexto da conversa entre os passos.

**Independent Test**: Ligar a opção, rodar Specify e depois Plan na mesma feature. Deve existir um só terminal dessa feature, com os dois passos nele.

**Acceptance Scenarios**:

1. **Given** a opção ligada e o terminal da feature aberto com a IA ativa, **When** a pessoa roda o próximo passo, **Then** o comando vai para a sessão da IA já aberta nesse terminal, e nenhum terminal novo é criado.
2. **Given** a opção ligada e o terminal da feature aberto com a IA já encerrada, **When** a pessoa roda o próximo passo, **Then** a IA é iniciada de novo nesse mesmo terminal com o passo.
3. **Given** a opção ligada e nenhum terminal da feature aberto (nunca abriu ou a pessoa fechou), **When** a pessoa roda um passo, **Then** um terminal novo é aberto, como hoje, e passa a ser o terminal da feature.
4. **Given** a opção desligada (padrão), **When** a pessoa roda um passo, **Then** nada muda: abre um terminal novo, como hoje.

---

### User Story 2 - Ligar e desligar a opção (Priority: P2)

A pessoa liga ou desliga o reaproveitamento nas configurações da extensão, no mesmo lugar das outras opções do SDD.

**Why this priority**: Sem um jeito de ligar, a P1 não pode ser usada; mas é um detalhe simples.

**Independent Test**: Alterar a opção e confirmar que o próximo passo respeita o novo valor, sem recarregar a janela.

**Acceptance Scenarios**:

1. **Given** a opção desligada, **When** a pessoa liga, **Then** o próximo passo já usa o terminal existente da feature.

---

### Edge Cases

- Features diferentes: cada uma tem o próprio terminal; um passo da feature A nunca vai para o terminal da feature B.
- A pessoa troca de IA (por exemplo, de Claude para Codex) com a sessão anterior ainda ativa: o passo não é digitado dentro da outra IA; abre-se um terminal novo para a IA escolhida.
- A IA está no meio de uma resposta quando a pessoa roda o próximo passo: o painel não interrompe; o pedido fica na fila da sessão, como se a pessoa o tivesse digitado.
- Terminais de manutenção abertos pelo painel (instalar Spec Kit, instalar integração, trocar de branch, atualizar extensão) não são reaproveitados e seguem o comportamento atual.
- Terminais abertos pela própria pessoa nunca recebem comandos do painel.
- A IA esquece de dizer a palavra-chave, ou a palavra aparece no meio da resposta: o painel pode mostrar o status errado, mas o envio dos passos não é afetado. O status volta a "em andamento" quando um novo passo começa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A extensão MUST oferecer uma opção para reaproveitar o terminal da feature entre passos, desligada por padrão.
- **FR-002**: Com a opção ligada, ao rodar um passo, a extensão MUST usar o terminal que ela abriu antes para a mesma feature e a mesma IA, se ele ainda estiver aberto, e trazê-lo para a frente.
- **FR-003**: Se a sessão da IA ainda estiver ativa nesse terminal, a extensão MUST enviar só o comando do passo para essa sessão; se não estiver, MUST iniciar a IA de novo nesse terminal com o passo.
- **FR-004**: Se não houver terminal reaproveitável, a extensão MUST abrir um novo, como hoje, e registrá-lo como o terminal da feature.
- **FR-005**: A extensão MUST enviar passos só para terminais que ela mesma abriu para aquela feature; terminais da pessoa, de outras features ou de manutenção nunca são reaproveitados.
- **FR-006**: Mudar a opção MUST valer a partir do próximo passo, sem recarregar a janela.
- **FR-007**: Com a opção ligada, o pedido de cada passo MUST pedir à IA que termine a resposta com uma palavra-chave fixa (ex.: "pronto"); quando ela aparecer no terminal da feature, o painel MUST mostrar o passo como concluído. Esse sinal é só visual: não segura nem libera o envio de passos.

### Key Entities

- **Terminal da feature**: terminal aberto pelo painel para rodar passos de uma feature com uma IA; ligado à feature e à IA que o originaram. Deixa de existir quando a pessoa o fecha.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com a opção ligada, rodar 5 passos seguidos de uma feature com a mesma IA deixa exatamente 1 terminal dessa feature aberto.
- **SC-002**: 0 comandos do painel são enviados a terminais abertos pela pessoa ou de outra feature.
- **SC-003**: Com a opção desligada, o comportamento é idêntico ao atual.
- **SC-004**: Ao rodar o próximo passo com a IA ainda ativa, a conversa anterior continua visível e disponível para a IA no mesmo terminal.
- **SC-005**: Quando a IA termina um passo dizendo a palavra-chave, o painel mostra "passo concluído" para aquela feature em até 2 segundos.

## Assumptions

- "Passo da feature" = comandos do Spec Kit rodados pelo painel (Specify, Clarify, Plan, Tasks, Analyze, Implement, Converge, Checklist), em qualquer IA suportada.
- A opção é por pessoa (configuração global do editor), igual às outras opções do SDD.
- Nenhum terminal é fechado pela extensão; fechar continua sendo decisão da pessoa.
- Terminais abertos antes de a extensão ser recarregada não são reconhecidos como terminal da feature; o primeiro passo depois disso abre um novo.
