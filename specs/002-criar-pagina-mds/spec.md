# Feature Specification: Página navegável dos documentos Markdown

**Feature Branch**: `002-criar-pagina-mds`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "queria uma pagina, pode ser um site ou wiki, algo assim onde podemos ver todos os arquivos md gerados pelo specify e oq significa, com rotas, links e etc, como se fosse uma documentação do docusauro ou wikia"

## Clarifications

### Session 2026-10-21

- Q: Onde a documentação fica disponível? → A: Site estático gerado numa pasta do repositório, para abrir no navegador ou publicar para quem não usa a extensão.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar e ler os documentos das features (Priority: P1)

Quem usa o projeto precisa consultar, em uma documentação navegável, todas as features existentes em `specs/` e todos os arquivos Markdown de cada feature. A pessoa vê um menu lateral organizado por feature e arquivo, abre qualquer documento em uma página própria e encontra o conteúdo formatado com títulos, tabelas, listas e caixas de seleção. A página inicial também apresenta cada feature e o passo atual dela, além da constituição do projeto.

**Why this priority**: É o valor principal da feature: tornar os documentos gerados pelo Spec Kit fáceis de encontrar e ler, sem procurar manualmente nas pastas.

**Independent Test**: Com pelo menos duas features e vários arquivos Markdown, abrir a documentação, escolher uma feature no menu, abrir um arquivo e confirmar que o documento é exibido formatado e que a página inicial mostra o passo atual e a constituição.

**Acceptance Scenarios**:

1. **Given** existem features em `specs/` com arquivos Markdown, **When** a pessoa abre a documentação, **Then** a página inicial lista todas as features e o passo atual de cada uma.
2. **Given** uma feature possui arquivos Markdown, **When** a pessoa escolhe a feature no menu lateral, **Then** seus arquivos aparecem organizados abaixo dela.
3. **Given** um arquivo Markdown aparece no menu, **When** a pessoa o seleciona, **Then** ele abre em um endereço próprio com títulos, tabelas, listas e caixas de seleção formatados.
4. **Given** a pessoa está na página inicial, **When** ela escolhe a constituição, **Then** o arquivo `.specify/memory/constitution.md` é exibido como uma página da documentação.

---

### User Story 2 - Entender os tipos de arquivo e seguir referências (Priority: P2)

Ao ler um documento, a pessoa precisa entender o papel daquele arquivo no fluxo do Spec Kit. Cada tipo conhecido apresenta uma explicação curta sobre o que é, qual passo o gera e quando deve ser lido, reaproveitando as explicações já existentes na wiki da feature. Os títulos do documento formam um índice da página. Links relativos para outros arquivos Markdown levam à página correspondente da documentação.

**Why this priority**: A navegação só resolve a localização; as explicações e os links dão contexto e permitem acompanhar o conjunto de documentos como uma documentação relacionada.

**Independent Test**: Abrir uma feature, conferir a explicação de `spec.md`, usar um link relativo para outro arquivo Markdown e selecionar um título no índice para chegar à seção correspondente.

**Acceptance Scenarios**:

1. **Given** a pessoa abre um tipo conhecido de arquivo, **When** ela consulta a página, **Then** vê uma explicação curta do que é o arquivo, qual passo o gera e quando o ler.
2. **Given** um documento contém um link relativo para outro arquivo Markdown existente, **When** a pessoa seleciona o link, **Then** a página do arquivo de destino é aberta.
3. **Given** um documento possui títulos, **When** a pessoa consulta o índice da página, **Then** os títulos aparecem organizados e cada item leva à seção correspondente.
4. **Given** um documento contém um link relativo para um arquivo inexistente, **When** a pessoa seleciona o link, **Then** recebe uma indicação clara de que o documento não foi encontrado, sem interromper a navegação.

---

### User Story 3 - Encontrar conteúdo por busca (Priority: P3)

Quando a pessoa não sabe em qual feature ou arquivo está uma informação, ela pesquisa um texto e vê os documentos que contêm o termo, podendo abrir cada resultado diretamente.

**Why this priority**: A busca acelera consultas em muitos documentos, mas a documentação continua útil sem ela por meio do menu e dos links.

**Independent Test**: Pesquisar uma palavra conhecida em vários arquivos e confirmar que os resultados identificam os arquivos correspondentes e abrem suas páginas.

**Acceptance Scenarios**:

1. **Given** existem documentos contendo o termo pesquisado, **When** a pessoa realiza a busca, **Then** os resultados mostram os documentos correspondentes e permitem abri-los.
2. **Given** nenhum documento contém o termo pesquisado, **When** a pessoa realiza a busca, **Then** recebe uma indicação de que não há resultados.

### Edge Cases

- Uma feature sem nenhum arquivo Markdown aparece no menu com uma indicação de que não há documentos para ler.
- Um arquivo Markdown muito grande (ex.: um tasks.md com centenas de tarefas) abre completo na sua página, sem cortar conteúdo.
- Um link relativo aponta para um arquivo que não existe: o destino informa o problema e preserva o restante da documentação.
- Um arquivo é alterado depois que o site foi gerado: o site mostra a versão do momento da geração até ser gerado de novo; gerar de novo traz a versão atual e remove páginas de arquivos apagados.
- Nomes de features, pastas e arquivos com acentos aparecem corretamente no menu, nos endereços e nas páginas.
- Um arquivo `.md` fora dos tipos conhecidos aparece normalmente no menu e pode ser lido, mas sem uma explicação específica de tipo.
- Um arquivo Markdown contém links relativos para outro diretório ou para outro documento da mesma feature: o destino deve ser resolvido a partir do arquivo de origem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A documentação MUST listar todas as features encontradas em `specs/` e todos os arquivos `.md` de cada feature, incluindo arquivos dentro de `contracts/` e `checklists/`.
- **FR-002**: A documentação MUST oferecer um menu lateral hierárquico no formato feature > arquivo, com a constituição disponível como item próprio.
- **FR-003**: A documentação MUST exibir cada arquivo Markdown em uma página própria, com títulos, tabelas, listas, caixas de seleção, blocos de código e links apresentados formatados (não como texto cru).
- **FR-004**: Cada página de arquivo MUST possuir um endereço próprio que permita voltar diretamente a ela e compartilhá-la dentro da documentação.
- **FR-005**: A documentação MUST transformar links relativos para arquivos Markdown existentes em links para as páginas correspondentes da documentação.
- **FR-006**: A documentação MUST informar de forma clara quando um link relativo aponta para um arquivo Markdown que não existe.
- **FR-007**: Cada página de documento MUST apresentar um índice formado pelos títulos do próprio documento, com navegação para cada seção.
- **FR-008**: A documentação MUST apresentar, para cada tipo conhecido de arquivo, uma explicação curta sobre o que é, qual passo o gera e quando ler, reaproveitando os textos existentes na wiki da feature. Tipos conhecidos: `spec.md`, `checklists/requirements.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md` e qualquer arquivo em `contracts/`.
- **FR-009**: A documentação MUST exibir arquivos Markdown fora dos tipos conhecidos no menu e permitir sua leitura sem exigir uma explicação específica.
- **FR-010**: A página inicial MUST listar cada feature e informar em que passo do fluxo ela está (um dos 7 passos já mostrados no painel SDD: Especificar, Esclarecer, Planejar, Tarefas, Conferir, Implementar, Fechar), além de oferecer acesso à constituição do projeto.
- **FR-011**: A documentação MUST permitir buscar texto em todos os documentos disponíveis e abrir cada resultado diretamente.
- **FR-012**: Gerar o site de novo MUST refletir o conteúdo atual de todos os arquivos `.md`, incluindo arquivos novos, alterados e apagados desde a geração anterior.
- **FR-013**: A documentação MUST lidar com nomes de arquivos, pastas e features que contenham acentos, mantendo os nomes legíveis e os endereços navegáveis.
- **FR-014**: A documentação MUST informar quando uma feature não possui nenhum arquivo Markdown, sem ocultar a feature do menu.
- **FR-015**: A documentação MUST ser somente para leitura e não permitir editar ou salvar os arquivos Markdown a partir dela.
- **FR-016**: A documentação MUST ser gerada como um site estático numa pasta do repositório, que abre em qualquer navegador sem a extensão instalada e sem servidor, e pode ser publicada para quem não usa a extensão.
- **FR-017**: Quem usa o painel SDD MUST conseguir gerar (ou gerar de novo) o site com uma única ação e abri-lo no navegador em seguida.

### Key Entities

- **Feature**: Pasta em `specs/` que reúne os documentos de uma entrega e possui um passo atual no fluxo do Spec Kit.
- **Documento Markdown**: Arquivo `.md` pertencente a uma feature ou à constituição, com conteúdo, títulos, links e elementos formatáveis.
- **Tipo de documento**: Categoria reconhecida pelo nome ou localização do arquivo, com uma explicação sobre seu papel no fluxo; documentos desconhecidos não recebem explicação.
- **Página de documento**: Visão navegável de um Documento Markdown, com endereço próprio, conteúdo formatado e índice de títulos.
- **Resultado de busca**: Referência a uma ou mais páginas de documento que contêm o texto pesquisado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos arquivos `.md` existentes em `specs/` aparecem no menu e podem ser abertos, inclusive os que estão em subpastas.
- **SC-002**: A pessoa consegue chegar a qualquer arquivo Markdown existente a partir da página inicial em no máximo 2 seleções no menu.
- **SC-003**: 100% dos tipos conhecidos de arquivo exibem a explicação de o que são, qual passo os gera e quando ler.
- **SC-004**: Em uma avaliação com 10 links relativos válidos entre documentos, 10 deles abrem a página correta do arquivo de destino.
- **SC-005**: Em uma avaliação com 20 termos presentes nos documentos, a busca encontra o arquivo correto em 100% dos casos e permite abri-lo a partir do resultado.
- **SC-006**: Depois de alterar um arquivo Markdown e gerar o site de novo, a página dele mostra a versão mais recente em 100% dos testes.
- **SC-007**: Em uma avaliação com nomes contendo acentos, 100% dos arquivos permanecem identificáveis no menu e abrem suas páginas sem erro.
- **SC-008**: Em um teste com 5 pessoas do time, pelo menos 4 identificam corretamente qual passo gera cada tipo conhecido de arquivo usando só a documentação.
- **SC-009**: A pasta gerada, copiada para outro computador sem a extensão, abre no navegador com menu, links e busca funcionando.

## Assumptions

- A “Wiki da feature” atual continua existindo e não é substituída por esta documentação geral.
- O conteúdo vem exclusivamente dos arquivos existentes no próprio repositório.
- A documentação é somente para leitura; alterações continuam sendo feitas nos arquivos do repositório pelos fluxos existentes.
- Os textos de `PASSOS` e `GLOSSARIO` já existentes em `wiki.js` são a fonte de conteúdo reutilizável para as explicações dos tipos e termos.
- O passo atual de uma feature pode ser identificado pelos documentos e pelo progresso já usado pelo projeto para a Wiki da feature.
- A constituição em `.specify/memory/constitution.md` é tratada como um documento navegável separado das features.
- A pasta de saída do site fica dentro do repositório; se ela entra ou não no git é decisão de cada time.
- HTML cru escrito dentro de um `.md` é exibido como está e pode rodar no site gerado; o risco é aceito porque o conteúdo vem do próprio repositório (ver research §10). Quem publicar o site deve revisar os `.md` antes.
- Suporte a edição, comentários, autenticação, a publicação em si (hospedar o site) e conteúdo que não esteja nos arquivos Markdown do repositório está fora do escopo desta feature.
