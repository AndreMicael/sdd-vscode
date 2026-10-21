# Feature Specification: Instalação automática do Specify

**Feature Branch**: Não criada; nenhum hook de criação de branch está configurado.

**Feature Directory**: `specs/001-install-specify`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Gere uma funcionalidade para que ao instalar esta extensão ela tambem instale o specify na maquina https://github.com/github/spec-kit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Começar a usar sem instalação manual (Priority: P1)

Como pessoa que instala a extensão SDD no VS Code ou Cursor, quero que ela prepare automaticamente o Specify na minha máquina para começar a trabalhar sem copiar comandos de instalação.

**Why this priority**: Remove o pré-requisito manual que impede o uso inicial das funções do Spec Kit.

**Independent Test**: Instalar a extensão em um ambiente local sem Specify, abrir o editor e confirmar que a preparação começa automaticamente e termina com o comando disponível.

**Acceptance Scenarios**:

1. **Given** um ambiente local suportado sem Specify e com acesso às fontes de distribuição, **When** o editor iniciar a extensão pela primeira vez após a instalação, **Then** ela inicia automaticamente a preparação e mostra seu andamento, mesmo sem projeto aberto ou painel SDD selecionado.
2. **Given** a ausência de dependências necessárias, **When** a preparação ocorrer, **Then** a extensão também providencia essas dependências no escopo do usuário quando permitido e informa qualquer impedimento que exija intervenção.
3. **Given** a preparação concluída, **When** a extensão validar a disponibilidade, **Then** informa sucesso somente se o Specify puder ser executado pelas suas ações e por um novo terminal local do editor.
4. **Given** um projeto sem Spec Kit, **When** a instalação do Specify terminar, **Then** nenhum arquivo do projeto é criado ou alterado; a inicialização do projeto continua disponível como ação explícita existente.

### User Story 2 - Preservar uma instalação existente (Priority: P1)

Como pessoa que já utiliza Specify, quero que a extensão aproveite minha instalação funcional para evitar reinstalações e alterações inesperadas.

**Why this priority**: A automação deve funcionar também para usuários atuais sem interromper seu ambiente.

**Independent Test**: Abrir a extensão com uma instalação compatível preexistente e confirmar disponibilidade sem downloads ou substituição da instalação.

**Acceptance Scenarios**:

1. **Given** uma instalação existente compatível com as funções da extensão, **When** ela iniciar, **Then** reconhece a instalação e a reutiliza sem reinstalar ou atualizar.
2. **Given** uma preparação concluída anteriormente, **When** o usuário reiniciar o editor ou atualizar a extensão, **Then** a disponibilidade é verificada novamente sem repetir a instalação se ela continuar funcional.
3. **Given** uma instalação encontrada que não atende às funções necessárias, **When** a verificação ocorrer, **Then** a extensão informa a incompatibilidade e oferece correção explícita sem substituir automaticamente a instalação do usuário.
4. **Given** duas janelas do editor abertas para o mesmo usuário, **When** ambas iniciarem a preparação, **Then** haverá no máximo uma instalação em andamento nesse ambiente e ambas poderão reconhecer o resultado.

### User Story 3 - Recuperar uma preparação interrompida (Priority: P2)

Como pessoa cuja preparação falhou ou foi cancelada, quero entender a causa e tentar novamente pelo editor, mantendo acesso às funções que não dependem do Specify.

**Why this priority**: Falhas de rede ou permissões não devem tornar a extensão inutilizável nem exigir sua reinstalação.

**Independent Test**: Simular ausência de rede, verificar a orientação exibida, restabelecer o acesso e concluir a instalação por uma ação de nova tentativa.

**Acceptance Scenarios**:

1. **Given** falha de rede, permissão, distribuição ou dependência, **When** a preparação não puder prosseguir, **Then** o usuário recebe uma mensagem com a etapa afetada, a causa conhecida e uma ação para tentar novamente ou seguir instruções de instalação manual.
2. **Given** uma instalação em andamento, **When** o usuário cancelar, **Then** a preparação é interrompida, não anuncia sucesso e não reinicia automaticamente até uma nova tentativa explícita.
3. **Given** uma preparação com falha, cancelada ou interrompida pelo fechamento do editor, **When** o usuário tentar novamente, **Then** a extensão verifica o estado real e conclui a preparação sem exigir reinstalar a extensão.
4. **Given** o Specify indisponível ou em instalação, **When** o usuário solicitar uma ação que dependa dele, **Then** a extensão informa o estado e orienta a concluir a preparação antes de repetir a ação; a leitura das features e da wiki permanece disponível.

### Edge Cases

- Instalação existente fora dos locais reconhecidos pelo editor: permitir nova verificação após o usuário corrigir a disponibilidade, sem declarar sucesso antecipadamente.
- Ambiente do editor desatualizado após instalar: orientar a reabertura do terminal ou do editor quando necessária e confirmar disponibilidade depois disso.
- Disco sem espaço, bloqueio de rede corporativa ou ausência de permissão: encerrar a tentativa com diagnóstico e recuperação, sem repetir indefinidamente.
- Fechamento do editor durante download ou instalação: tratar a preparação como interrompida e verificar o estado real antes de retomá-la.
- Remoção manual do Specify após uma preparação bem-sucedida: detectar a indisponibilidade na próxima verificação e oferecer reparo.
- Ambiente remoto ou navegador: informar que a preparação automática local não se aplica, sem instalar silenciosamente em outro computador ou contêiner.
- Instalação da extensão pelo script existente ou diretamente pelo pacote: oferecer o mesmo resultado na primeira execução pelo editor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A extensão DEVE iniciar automaticamente a verificação e, se necessário, a instalação do Specify na primeira execução após sua instalação, sem depender de projeto previamente configurado ou abertura do painel SDD.
- **FR-002**: A preparação DEVE atender ao uso local no VS Code e Cursor em Windows, macOS e Linux, respeitando os ambientes suportados pela distribuição oficial do Specify.
- **FR-003**: A extensão DEVE verificar se o Specify pode executar as funções de inicialização de projeto e gerenciamento de integrações já utilizadas pela extensão antes de considerá-lo pronto.
- **FR-004**: A extensão DEVE reutilizar uma instalação compatível existente sem reinstalação ou atualização automática; incompatibilidades DEVEM ser apresentadas com opção explícita de correção.
- **FR-005**: Quando não houver instalação existente, a extensão DEVE instalar o Specify e preparar as dependências ausentes necessárias, a partir das fontes oficiais, no escopo do usuário e sem exigir privilégios administrativos no fluxo normal. Restrições que impeçam esse fluxo DEVEM resultar em orientação acionável.
- **FR-006**: A extensão DEVE mostrar os estados de verificação, instalação, pronto, falha, cancelamento e ambiente não suportado, incluindo a etapa atual durante a preparação.
- **FR-007**: A preparação DEVE permitir cancelamento e manter o editor e as funções independentes do Specify utilizáveis durante sua execução.
- **FR-008**: A extensão DEVE confirmar a execução do Specify antes de anunciar sucesso e assegurar sua disponibilidade para as ações existentes e para novos terminais locais do editor. Se for necessário reabrir o editor, DEVE indicar essa pendência antes de marcar o ambiente como pronto.
- **FR-009**: Falhas DEVEM apresentar a causa conhecida e disponibilizar nova tentativa, nova verificação e instruções de preparação manual. Cancelamentos e falhas NÃO DEVEM provocar novas instalações automáticas a cada abertura do editor.
- **FR-010**: A extensão DEVE impedir instalações simultâneas para o mesmo usuário e ambiente, inclusive entre janelas, e permitir recuperação após uma tentativa interrompida.
- **FR-011**: A extensão DEVE verificar novamente a disponibilidade nas execuções seguintes e antes das ações dependentes, oferecendo reparo se uma instalação antes funcional tiver sido removida ou danificada.
- **FR-012**: As ações dependentes do Specify DEVEM comunicar sua indisponibilidade antes de tentar executá-lo, sem alterar o projeto ou anunciar a ação como concluída.
- **FR-013**: A instalação do Specify NÃO DEVE inicializar projetos, instalar integrações de agentes nos repositórios ou modificar arquivos de trabalho automaticamente.
- **FR-014**: Em ambientes remotos ou de navegador, a extensão DEVE informar a limitação da preparação local e orientar a preparação no ambiente adequado, sem executar instalação automática em destino diferente do escopo local definido.
- **FR-015**: As instruções de instalação da extensão DEVEM explicar a preparação automática, seus pré-requisitos de conectividade, os estados de recuperação e a separação entre instalação do Specify e configuração por projeto.

### Key Entities

- **Ambiente de preparação**: Contexto local do usuário, editor e sistema operacional em que a disponibilidade do Specify é verificada.
- **Instalação do Specify**: Distribuição identificada, sua disponibilidade e compatibilidade com as funções usadas pela extensão.
- **Tentativa de preparação**: Estado, etapa atual, resultado e motivo de falha ou cancelamento; permite comunicar progresso e orientar uma nova tentativa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em todos os cenários de aceitação de instalação limpa nos ambientes locais suportados, com rede e permissões disponíveis, o usuário consegue concluir a preparação sem digitar comandos de instalação.
- **SC-002**: Em todos os cenários com instalação compatível preexistente, a extensão fica pronta sem reinstalar, atualizar ou substituir essa instalação.
- **SC-003**: Todos os cenários de falha e cancelamento exibem estado correto e uma próxima ação; após corrigir a causa, a preparação pode ser concluída com uma nova tentativa, sem reinstalar a extensão.
- **SC-004**: Em todos os cenários de instalação, falha ou cancelamento, o usuário mantém acesso à leitura das features e à wiki, e nenhum arquivo de projeto é alterado pela preparação.
- **SC-005**: Em testes com duas janelas simultâneas no mesmo ambiente, ocorre no máximo uma instalação e ambas reconhecem a disponibilidade final após verificação.

## Assumptions

- “Ao instalar a extensão” significa preparar automaticamente na primeira execução pelo editor após a instalação, inclusive quando ainda não houver projeto aberto.
- O escopo inicial é a máquina local e a conta do usuário. Preparação automática em servidores remotos, contêineres, WSL como destino remoto e navegador fica fora desta funcionalidade.
- A preparação deve incluir dependências ausentes quando puder fazê-lo no escopo do usuário; acesso às fontes oficiais e permissões de escrita nesse escopo são necessários para o fluxo automático.
- A política exata de versões compatíveis e os mecanismos de distribuição e instalação serão definidos no planejamento, preservando os resultados exigidos nesta especificação.
- Atualizações automáticas periódicas e desinstalação do Specify junto com a extensão ficam fora do escopo. Agentes de IA continuam sendo preparados separadamente.

## References

- [Repositório oficial do Spec Kit](https://github.com/github/spec-kit), consultado em 2026-10-21: apresenta a instalação do Specify separadamente da inicialização de projetos e informa os pré-requisitos da distribuição.
- `README.md` deste projeto: atualmente trata Specify como pré-requisito manual e descreve a inicialização de repositórios como ação do painel.
