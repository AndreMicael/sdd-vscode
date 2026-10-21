# Modelo de dados

## SetupEnvironment

| Campo | Regra |
|---|---|
| key | Identificador local estável de usuário/host, não sincronizado |
| platform / arch | Plataforma/arquitetura detectadas |
| editor / remoteName / uiKind | Contexto; remoto/browser impede bootstrap |
| root | Caminho absoluto fora de workspaces |
| supported / reason | Elegibilidade e motivo da limitação |

Um ambiente tem uma instalação selecionada e várias tentativas sequenciais. Editores compartilham raiz/lock; cada janela valida seu próprio terminal.

## SpecifyInstallation

| Campo | Regra |
|---|---|
| executable / binDirectory | Caminhos absolutos normalizados |
| origin | external ou managed |
| version | Versão retornada, não prova isolada de compatibilidade |
| capabilities | Resultados de init/integration e flags obrigatórias |
| checkedAt | Última verificação |
| terminalVerified | Por janela/shell; não reutilizar prova de outro editor |

Não sobrescrever instalações externas. Registro salvo é pista de descoberta; remoção invalida prontidão na próxima verificação.

## SetupAttempt e estado persistente

| Campo | Regra |
|---|---|
| schemaVersion | Inteiro, inicialmente 1; desconhecido bloqueia escrita automática |
| attemptId | ID aleatório que associa processos, resultado e lock |
| state | Enum abaixo |
| stage | detect, lock, uv, python, specify, validate, terminal |
| trigger | activation, retry, repair, recheck, command |
| automaticAttemptConsumed | Persistido antes de qualquer instalação |
| startedAt / updatedAt / finishedAt | Datas UTC; fim ausente enquanto ativo |
| installation | Registro opcional selecionado |
| error | code, stage, message, exitCode opcional; sem credenciais |
| recoveryActions | Ações válidas na situação |

Estados públicos: checking, installing, ready, failed, cancelled, unsupported. Auxiliares: idle, waiting, incompatible, interrupted, verification-required, repair-required.

Transições:

- idle → checking na ativação/rechecagem.
- checking → ready somente após CLI e terminal validados na janela.
- checking → installing apenas na primeira tentativa automática sem candidato ou por retry/repair explícito; exige lock e nova descoberta dentro dele.
- checking → incompatible se candidato falha capacidades; → repair-required se instalação anterior desapareceu; → unsupported se host fora de escopo.
- checking → waiting se outra janela instala; depois retorna a checking.
- installing → verification-required quando CLI funciona mas falta shell; → ready apenas após confirmação das duas condições.
- installing → failed/cancelled/interrupted em erro/cancelamento/perda confirmada do proprietário; nenhuma reinstalação automática na próxima ativação.
- Estados de recuperação → checking por ação explícita. Instalar somente se retry/repair autorizar e rechecagem não resolver.
- Qualquer rechecagem pode reconhecer reparo manual sem download.

checking não apaga resultado anterior nem política de tentativa. JSON inválido ou falha de leitura exige recuperação explícita; não significa primeira instalação.

## InstallationLock

Campos: schemaVersion, token, attemptId, ownerPid, ownerStartedAt, heartbeatAt, childProcesses com PID/identidade. Criação exclusiva antes de instalar. Só dono com token atual libera após filhos terminarem. Timestamp vencido não autoriza remoção. Recuperação serializada revalida token/liveness; em dúvida não instala.

## Dados efêmeros

SetupSnapshot combina persistência e diagnóstico local para UI. TerminalVerification registra tentativa, shell, código de saída, caminho resolvido e token em temporário restrito ao usuário. Logs limitados removem credenciais de URLs/ambiente. Nenhum segredo ou caminho de workspace é necessário para bootstrap.
