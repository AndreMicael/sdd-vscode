# Implementation Plan: Instalação automática do Specify

**Branch**: `001-instalacao-specify-automatica` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-install-specify/spec.md`

O setup foi executado com `SPECIFY_FEATURE_DIRECTORY` explícito e persistiu o contexto em `.specify/feature.json`. Retornou `BRANCH=001-install-specify` como identificador derivado da pasta; a branch Git efetiva é a indicada acima. Nenhuma branch foi criada ou trocada. O campo histórico da spec foi preservado.

## Summary

Preparar Specify na primeira ativação local, inclusive sem workspace, reutilizando instalações compatíveis. Um serviço assíncrono separado da UI fará descoberta, instalação de uv/Python/Specify, cancelamento, persistência e exclusão mútua entre janelas. Disponibilizar o CLI nas ações SDD e nos novos terminais; falhas, incompatibilidades e cancelamentos exigem recuperação explícita. Bootstrap nunca executa init nem instala integrações no projeto.

## Technical Context

**Language/Version**: JavaScript CommonJS sem transpilation; APIs Node compatíveis com o extension host do VS Code mínimo 1.85.0.

**Primary Dependencies**: API estável VS Code; módulos nativos Node (`fs`, `path`, `os`, `child_process`, `https`, `crypto`); uv oficial; Python 3.11 gerenciado por uv; `specify-cli==1.2.2` como alvo inicial. Validar capacidades e matriz antes de publicar; não adicionar framework de runtime.

**Storage**: JSON versionado e lock em diretório de dados do usuário compartilhado entre VS Code/Cursor e perfis. Ferramentas em subdiretórios próprios; nada no workspace. `globalState` não serve como lock.

**Testing**: `npm test` / `node --test`; adapters simulados, concorrência real em diretório temporário e aceitação no editor em máquinas descartáveis.

**Target Platform**: VS Code >=1.85 e Cursor desktop compatível em Windows/macOS/Linux nas arquiteturas atendidas por uv/Python. Hosts remotos, WSL remoto e navegador não executam bootstrap.

**Project Type**: Extensão desktop com comandos, árvores e webviews existentes.

**Performance Goals**: Registrar UI antes de I/O assíncrona; nenhum processo/rede síncrono no bootstrap. Probes limitados a 15 s cada; tentativa de instalação até 10 min, cancelável. Limites operacionais propostos, não medições já obtidas.

**Constraints**: Sem administrador; preservar cópias existentes; uma instalação por usuário/host; não alterar repositórios; sem auto-update periódico; confirmar execução e terminal antes de ready.

**Scale/Scope**: Um ambiente local por usuário, múltiplas janelas e dois editores; três histórias e quinze requisitos. Agentes de IA e operações Git existentes permanecem pré-requisitos separados.

## Constitution Check

**Antes da pesquisa**: `.specify/memory/constitution.md` contém apenas placeholders e exemplos comentados. Não há princípios ratificados avaliáveis; exemplos não são obrigações. Gate constitucional não aplicável, sem violação identificada. Não equivale a aprovação por uma constituição definida.

**Reavaliação após Phase 1**: a situação constitucional permanece igual. Gates da especificação foram atendidos pelo design:

| Gate | Decisão | Resultado |
|---|---|---|
| FR-001/002/014 | onStartupFinished e classificação do host antes de instalar | Passa |
| FR-003/004 | Probes de capacidades; correção explícita em cópia isolada | Passa |
| FR-005/013 | PyPI oficial, uv/Python no usuário e cwd isolado | Passa |
| FR-006/007/009 | Estados persistentes, progresso cancelável e recuperação explícita | Passa |
| FR-008/011/012 | Resolver absoluto, PATH e revalidação antes de ações | Passa |
| FR-010 | Lock atômico compartilhado e recuperação conservadora | Passa |
| FR-015 | README e guia com cenários de recuperação | Passa |

Não há clarificação técnica pendente. A aceitação real é trabalho da implementação; não foi executada neste planejamento.

## Project Structure

### Documentation (this feature)

```text
specs/001-install-specify/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── specify-setup.md
```

`tasks.md` será produzido por `$speckit-tasks`, fora deste comando.

### Source Code (repository root)

```text
extension.js                  # integrar serviço, UI, comandos e gates
specify-setup.js               # novo: orquestração, descoberta e estados
specify-platform.js            # novo: processos, download, PATH e adapters por SO
specify-store.js               # novo: JSON, lock e recuperação
lib.js                        # preservar helpers de projeto
package.json                  # ativação e comandos
.vscodeignore                 # excluir novos testes do pacote
README.md                     # preparação e troubleshooting
test.js                       # regressão existente
test/
├── specify-setup.test.js      # novo: estados/decisões
├── specify-platform.test.js   # novo: processos/ambiente/quoting
└── specify-store.test.js      # novo: concorrência/recuperação
```

**Structure Decision**: Manter CommonJS e formato plano. Separar orquestração, efeitos do sistema e persistência permite testar sem importar vscode. Não criar servidor ou novo projeto. Instaladores da extensão e VSIX convergem na ativação.

## Phase 0 — Pesquisa

Ver [research.md](research.md). Foram resolvidas distribuição/versão, dependências, compatibilidade, ativação, PATH, concorrência e recuperação. Pesquisa local delegada confirmou que `terminal()` apenas despacha texto e não prova sucesso; `rodar()` e `instalarSpecKit()` concentram uso do CLI.

## Phase 1 — Design e sequência de integração

1. Registrar UI e comandos; iniciar check em background, sem aguardar downloads em activate.
2. Classificar host, ler estado e descobrir candidatos. Reutilizar instalação compatível. Apenas ambiente nunca preparado e sem instalação inicia automaticamente.
3. Adquirir lock e repetir descoberta. Preparar uv/Python ausentes e instalar Specify isoladamente; validar CLI e shell antes de ready.
4. Aplicar ensureReady em instalarSpecKit e no ramo de rodar que instala integração, antes de comandos/alterações. A execução de agente com integração já instalada continua independente do CLI.
5. Preservar `SPECIFY_FEATURE_DIRECTORY` e usar ambiente preparado nos terminais. Corrigir seleção de script de projeto para ps em Windows e sh em Unix, em vez do ps fixo atual, nas duas chamadas do CLI.
6. Publicar progresso, diagnóstico e recuperação; tratar cancelamento, desativação e múltiplas janelas. Estado ready salvo não dispensa probes.
7. Atualizar README/empacotamento e executar [quickstart.md](quickstart.md).

Entidades: [data-model.md](data-model.md). Interfaces e invariantes: [contracts/specify-setup.md](contracts/specify-setup.md).

## Complexity Tracking

Nenhuma violação constitucional a justificar. Lock e validação de terminal são necessários para FR-008/010; Promise local e sendText isoladamente não atendem esses requisitos.
