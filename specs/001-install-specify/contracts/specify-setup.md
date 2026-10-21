# Contratos de serviço e UI

## Serviço CommonJS proposto

`createSpecifySetup({platform, store, report})` recebe adapters; núcleo não importa vscode.

| Operação | Resultado/efeito |
|---|---|
| check({reason}) | Promise de snapshot; probes, instalação inicial somente quando reason=activation e política permitir |
| retry() | Reavalia realidade; tentativa explícita respeita lock e deduplicação |
| repair() | Após escolha explícita, cria cópia gerenciada preservando externa; explica prioridade no PATH |
| ensureReady() | Revalida; retorna ready, executable/env opcionais e snapshot; false proíbe execução/alteração do projeto |
| cancel() | Interrompe tentativa própria e aguarda filhos; observadora cancela só espera |
| subscribe(listener) | Snapshots de progresso; retorna disposable |
| dispose() | Interrompe processos próprios e libera recursos; fechamento abrupto tratado pela recuperação |

Erros esperados são snapshots. Adapter de UI captura rejeições inesperadas e converte em diagnóstico. Uma Promise em andamento deduplica chamadas dentro da janela; lock coordena processos.

## Comandos públicos propostos

| ID | Comportamento |
|---|---|
| sdd.verificarSpecify | SDD: Verificar Specify; apenas probes, nunca reinstala |
| sdd.prepararSpecify | SDD: Preparar Specify; nova tentativa explícita |
| sdd.repararSpecify | SDD: Reparar Specify; explica cópia isolada e prioridade antes de executar |
| sdd.cancelarSpecify | SDD: Cancelar preparação do Specify |
| sdd.diagnosticoSpecify | SDD: Abrir diagnóstico do Specify |

Publicar na command palette sem exigir workspace. Usar withProgress cancelável, OutputChannel `SDD: Specify`, estado no painel/status e notificações sem repetição em cada reload. Falha informa etapa, causa conhecida, Tentar novamente, Verificar novamente e instruções manuais oficiais. Incompatibilidade/remoção oferece Reparar. Pendência de terminal orienta reabertura/reload e revalidação, sem anunciar sucesso. Remoto explica escopo correto sem baixar; web recebe orientação via indisponibilidade do pacote Node e README.

## Processos e validação

- Probes: `specify version`, `specify init --help`, `specify integration install --help`. Exigir zero e flags definidas em research. Nunca executar init real durante bootstrap.
- Instalação por uv resolvido, argumentos separados, versão fixa, ambiente isolado e cwd gerenciado. shell=false para executáveis; scripts oficiais via interpretador explícito. Testar caminhos com espaços/Unicode.
- HTTPS oficial com TLS, timeout, cancelamento e redirects limitados. Não desativar certificados para contornar bloqueio corporativo.
- ready exige execução, capacidades e terminal validado. Download/processo iniciado/sendText não comprovam sucesso.
- Probes: 15 s cada. Tentativa: até 10 min. Encerrar árvore antes de permitir nova instalação após timeout/cancelamento.

## Ações existentes

instalarSpecKit consulta ensureReady antes do prompt/despacho; retorna false quando indisponível. O ramo de integração ausente de rodar aplica o mesmo gate antes de enviar integration install. Não executar comandos preparatórios como git switch antes do gate quando a ação depender do CLI. Preservar confirmação de alterações de projeto.

Terminal usa ambiente preparado e executável validado, com quoting específico se houver despacho textual; preservar SPECIFY_FEATURE_DIRECTORY. Selecionar --script ps em Windows e sh em Unix nas chamadas init/integration. Agente cuja integração já existe, árvores e wiki continuam independentes do bootstrap. Atualizar UI explicitamente ao concluir preparação; o watcher atual não observa integration.json.

## Invariantes

1. Nenhum bootstrap em remote/browser ou diretório de projeto.
2. Uma árvore de instaladores no máximo por ambiente.
3. Sem reinstalação automática após falha/cancelamento/interrupção ou remoção posterior.
4. Nenhum download para candidato compatível.
5. Correção não apaga nem atualiza cópia externa.
6. Sucesso somente após CLI e shell confirmados.
7. Falha de persistência nunca autoriza nova tentativa automática.
