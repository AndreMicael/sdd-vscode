# Feature Specification: Ativar skills do Claude na caixa de ação

**Feature Branch**: `003-ativar-skills-claude`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "quero que seja possivel eu utilizar skills do claude quando eu selecionar a IA dentro da caixa de ação, atualmente temos apenas o nome, mas nao funciona, não ativa a skill quando eu seleciono ela"

## Clarifications

### Session 2026-10-21

- Q: De onde instalar a skill de orquestração quando ela não estiver instalada? → A: Do repositório https://github.com/AndreMicael/orq-skill (pacote com `/orq` e `/orq-lazy`).
- Q: Depois da instalação bem-sucedida no meio de um passo elegível, o que acontece com aquele passo? → A: Sempre perguntar: “Rodar agora com skill” ou “Depois”.
- Q: Como a pessoa percebe que a skill foi aplicada na execução? → A: Sinal no comando/prompt enviado à sessão e confirmação explícita na UI da extensão ao iniciar a execução.
- Q: Se a pessoa escolhe “Rodar sem orquestração” porque a skill falta, a preferência salva muda? → A: Não; a preferência permanece; só aquela execução segue sem skill.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher uma skill e vê-la valer na execução (Priority: P1)

Quem usa a extensão escolhe Claude como IA na caixa de ação, seleciona uma skill de orquestração disponível (por exemplo `/orq` ou `/orq-lazy`) e executa um passo elegível do Spec Kit. A skill escolhida passa a orientar aquela execução: o agente recebe a invocação da skill e age de acordo com ela, não apenas exibe o nome da opção na interface.

**Why this priority**: É o problema relatado — a seleção existe só como rótulo e não muda o comportamento da execução.

**Independent Test**: Com Claude selecionado e uma skill de orquestração escolhida, executar um passo elegível e confirmar que a sessão inicia com a skill ativada (e não como uma chamada comum sem skill).

**Acceptance Scenarios**:

1. **Given** a IA selecionada é Claude e a orquestração está em `/orq`, **When** a pessoa executa um passo elegível, **Then** a UI confirma que `/orq` será aplicada e a invocação enviada à sessão inclui `/orq`.
2. **Given** a IA selecionada é Claude e a orquestração está em `/orq-lazy`, **When** a pessoa executa um passo elegível, **Then** a UI confirma que `/orq-lazy` será aplicada e a invocação enviada à sessão inclui `/orq-lazy`.
3. **Given** a IA selecionada é Claude e a orquestração está desligada, **When** a pessoa executa o mesmo passo, **Then** a execução segue sem ativar skill de orquestração.
4. **Given** a pessoa acabou de mudar a skill na caixa de ação, **When** ela executa o próximo passo elegível, **Then** vale a skill recém-selecionada (não a anterior).

---

### User Story 2 - Entender quando a skill se aplica (Priority: P2)

Na caixa de ação, a pessoa vê quando pode escolher skill e para quais passos ela vale. Se a skill escolhida não estiver instalada na máquina, recebe um caminho claro para instalar ou seguir sem orquestração, sem ficar com a impressão de que a skill “está ativa” quando na verdade não está.

**Why this priority**: Evita falsa sensação de ativação e reduz tentativas frustradas.

**Independent Test**: Alternar a IA para não-Claude, voltar para Claude, escolher uma skill ausente na máquina e confirmar mensagens e opções coerentes.

**Acceptance Scenarios**:

1. **Given** a IA selecionada não é Claude, **When** a pessoa olha a caixa de ação, **Then** as opções de skill de orquestração do Claude não ficam disponíveis para escolha.
2. **Given** a IA é Claude e a skill escolhida não está instalada, **When** a pessoa executa um passo elegível, **Then** recebe a opção de instalar a skill a partir de https://github.com/AndreMicael/orq-skill ou seguir sem orquestração, sem simular ativação; se seguir sem orquestração, a preferência salva na caixa permanece inalterada.
3. **Given** a instalação a partir desse fluxo terminou com sucesso, **When** o produto pergunta o próximo passo, **Then** a pessoa escolhe entre “Rodar agora com skill” (o passo elegível segue com a skill ativa) ou “Depois” (o fluxo encerra sem rodar; a próxima execução elegível com a mesma escolha ativa a skill).

---

### User Story 3 - Preferência lembrada entre usos (Priority: P3)

A escolha de IA e de skill permanece entre aberturas da caixa de ação e sessões do editor, até a pessoa mudar de novo.

**Why this priority**: Evita reconfigurar a cada uso; a correção principal (ativação real) já entrega valor sem isso.

**Independent Test**: Escolher Claude e uma skill, fechar e reabrir a caixa de ação (ou recarregar a janela) e confirmar que as mesmas opções aparecem selecionadas e ainda ativam na próxima execução.

**Acceptance Scenarios**:

1. **Given** a pessoa escolheu Claude e uma skill, **When** reabre a caixa de ação, **Then** vê as mesmas opções selecionadas.
2. **Given** essas preferências estão salvas, **When** executa um passo elegível, **Then** a skill salva é a que é ativada.

### Edge Cases

- Skill selecionada mas passo fora dos elegíveis para orquestração: a execução segue sem ativar a skill, sem erro confuso.
- Após instalar com sucesso, se a pessoa escolhe “Depois”: o passo atual não roda; a próxima execução elegível com a mesma skill selecionada ativa a skill.
- Instalação falha (rede, ferramenta ausente, etc.): o produto informa o erro e não simula ativação; a pessoa pode tentar de novo ou seguir sem orquestração na próxima tentativa.
- “Rodar sem orquestração” com skill faltante: só aquela execução segue sem skill; a preferência salva (`/orq` ou `/orq-lazy`) não muda.
- Troca de IA de Claude para outra e volta para Claude: a skill salva continua disponível e, se ainda selecionada, volta a valer nos passos elegíveis.
- Execução enquanto a preferência de skill ainda está sendo gravada: a execução usa o valor efetivamente escolhido na caixa no momento do envio.
- Skill desinstalada manualmente após ter sido selecionada: na execução elegível, o fluxo de “não instalada” aparece de novo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Com Claude como IA na caixa de ação, o produto MUST permitir escolher uma skill de orquestração entre as opções oferecidas (`desligada`, `/orq`, `/orq-lazy`).
- **FR-002**: Quando uma skill de orquestração estiver selecionada e a pessoa executar um passo elegível, o produto MUST ativar essa skill na execução — não apenas exibir o nome na interface.
- **FR-003**: Com orquestração desligada, o produto MUST executar o passo sem ativar skill de orquestração.
- **FR-004**: A mudança de skill na caixa de ação MUST valer já na próxima execução elegível iniciada a partir da caixa.
- **FR-005**: Opções de skill de orquestração do Claude MUST estar disponíveis somente quando a IA selecionada for Claude.
- **FR-006**: Se a skill selecionada não estiver instalada na máquina no momento da execução elegível, o produto MUST informar e oferecer instalar a partir de https://github.com/AndreMicael/orq-skill (fonte oficial do pacote `/orq` e `/orq-lazy`) ou seguir sem orquestração, sem fingir que a skill está ativa.
- **FR-007**: Após instalação bem-sucedida nesse fluxo, o produto MUST perguntar se a pessoa quer “Rodar agora com skill” ou “Depois”; em “Rodar agora com skill”, o passo elegível em curso MUST seguir com a skill ativa; em “Depois”, MUST encerrar sem rodar e a próxima execução elegível com a mesma skill selecionada MUST ativar a skill.
- **FR-011**: A instalação oferecida quando a skill falta MUST obter `/orq` e `/orq-lazy` desse repositório (não de outra origem).
- **FR-012**: Se a pessoa escolher seguir sem orquestração porque a skill selecionada não está instalada, o produto MUST executar aquele passo sem skill e MUST NOT alterar a preferência salva de skill na caixa de ação.
- **FR-008**: A escolha de IA e de skill MUST ser lembrada entre usos da caixa de ação até a pessoa alterar.
- **FR-009**: Em passos não elegíveis para orquestração, o produto MUST não ativar a skill mesmo que ela esteja selecionada, sem bloquear a execução do passo.
- **FR-010**: Quando uma skill de orquestração for ativada num passo elegível, o produto MUST (1) mostrar confirmação explícita na UI de que aquela skill será aplicada e (2) incluir a invocação da skill (`/orq` ou `/orq-lazy`) no comando/prompt enviado à sessão — de modo que a pessoa distinga da execução sem skill.

### Key Entities

- **IA selecionada**: Agente escolhido na caixa de ação para rodar o comando do Spec Kit.
- **Skill de orquestração**: Opção associada ao Claude (`/orq` ou `/orq-lazy`) que, quando ativa, altera o comportamento da execução elegível.
- **Passo elegível**: Passo do Spec Kit no qual a skill de orquestração pode ser aplicada (Plan até Converge, conforme o comportamento já comunicado na interface).
- **Caixa de ação**: Formulário da extensão onde a pessoa escolhe IA, skill e dispara criar feature ou executar passo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das execuções de passo elegível com Claude e `/orq` ou `/orq-lazy` selecionados (e skill instalada), a skill correspondente é ativada na sessão.
- **SC-002**: Em 100% das execuções com orquestração desligada, nenhuma skill de orquestração é ativada.
- **SC-003**: Após trocar a skill na caixa e executar de novo, 100% das execuções elegíveis usam a skill recém-escolhida.
- **SC-004**: Quando a skill não está instalada, 100% das tentativas elegíveis mostram o fluxo de instalar ou seguir sem orquestração, sem ativação silenciosa falsa.
- **SC-006**: Após instalação bem-sucedida no fluxo do passo elegível, 100% das vezes o produto pergunta “Rodar agora com skill” ou “Depois” antes de continuar ou encerrar.
- **SC-005**: Em avaliação com usuários que já usam a caixa de ação, pelo menos 9 em 10 reconhecem que a skill escolhida passou a alterar a execução (não só o rótulo na tela), apoiando-se na confirmação da UI e na presença da skill no comando/prompt.
- **SC-007**: Em 100% das ativações elegíveis com skill, há confirmação na UI e a invocação da skill aparece no comando/prompt enviado à sessão.

## Assumptions

- O escopo desta feature são as skills de orquestração já apresentadas na caixa (`/orq` e `/orq-lazy`), não o catálogo completo de skills do Claude na máquina.
- Os passos elegíveis para orquestração continuam sendo os já indicados na interface (Plan até Converge); Specify e demais passos fora dessa faixa não ativam a skill.
- A instalação das skills de orquestração, quando faltam, usa https://github.com/AndreMicael/orq-skill como origem do pacote (`/orq` e `/orq-lazy`).
- Skills Spec Kit (`/speckit-*`) e a seleção de IA em si não são redesenhadas; o foco é fazer a skill de orquestração selecionada realmente ativar.
- Listar ou escolher qualquer skill arbitrária de `~/.claude/skills` fica fora do escopo desta entrega.
