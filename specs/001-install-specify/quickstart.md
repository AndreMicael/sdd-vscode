# Guia de validação

Ver [contrato](contracts/specify-setup.md) e [modelo](data-model.md). A evidência automatizada abaixo não substitui a aceitação nos editores.

## Execução em 2026-10-21

Ambiente: Windows x64, build 10.0.26200, PowerShell 5.1.26100.9711, Node 22.17.0 e npm 11.5.2.

- `npm test`: resultado final **43 testes, 43 aprovados, 0 falhas, 0 ignorados**, duração do runner 6,38 s. Inclui regressão original e os três arquivos `test/specify-*.test.js`.
- Testes novos usam adapters para rede/instalação e diretórios temporários. Nenhum uv/Python/Specify foi instalado na conta pessoal.
- Concorrência: cinco processos disputaram o lock; exatamente um proprietário. Três processos do serviço compartilharam uma instalação simulada; exatamente um instalador e três provas de terminal independentes.
- Preservação: hashes SHA-256 e nomes dos arquivos de fixture iguais antes/depois dos cenários de bootstrap.
- Windows: testes reais de cmd e PowerShell com CLI falso, caminhos com espaços/Unicode, timeout, cancelamento e término de descendentes. O wrapper `specify-process.ps1` usa Job Object com kill-on-close para manter descendentes ligados à vida do instalador; integra o pacote, sem dependência de runtime adicional.
- Recuperação: estado inválido/esquema desconhecido, falha de escrita, proprietário ambíguo, filho vivo, lock de recuperação órfão, recuperadores concorrentes e troca de token não autorizam instalação insegura.
- Terminal: execução real nos shells Windows; prova por token, saída zero e caminho normalizado; fallback integrado testado com adapter e arquivo de resultado. `sendText` não constitui prova.
- O sandbox bloqueou rede npm e encerramento de processos; empacotamento e testes de processos foram executados com permissão fora dele. A árvore de teste presa foi identificada e encerrada, sem encerrar processos do usuário.
- `.specify/extensions.yml` ausente: nenhum hook before/after implement a executar.
- Fontes oficiais verificadas durante implementação: [variáveis uv](https://docs.astral.sh/uv/reference/environment/), [opções do instalador](https://docs.astral.sh/uv/reference/installer/) e [endpoint PowerShell](https://astral.sh/uv/install.ps1). O endpoint redireciona para `releases.astral.sh`; esse host foi incluído na lista HTTPS e no teste de redirects. Não foi executado o instalador remoto.

### Matriz de aceitação T037 — concluída com sucesso

O usuário confirmou nesta conversa que realizou os testes e solicitou o registro
de conclusão com sucesso. A aceitação manual abaixo é registrada com base nessa
confirmação; não foi executada novamente pelo agente. Logs, versões resolvidas e
medições individuais dos ambientes não foram fornecidos.

Empacotamento final: `npx --yes @vscode/vsce package --allow-missing-repository`
gerou `sdd-speckit-0.12.2.vsix`, 13 entradas, aproximadamente 45 KB. O VSIX foi
aberto como ZIP e os cinco arquivos de implementação foram comparados byte a byte
com as fontes atuais. Inclui os três módulos Specify, o wrapper Windows,
`extension.js`, `package.json`, `README.md`, bibliotecas existentes, instalador da
extensão e ícone. Exclui `test.js`, `test/`, `specs/`, `.agents/` e `.specify/`.
Durante o empacotamento pelo agente, nenhuma publicação ou instalação da extensão foi feita. O empacotador emitiu o
aviso de LICENSE ausente, já compatível com o manifesto existente `UNLICENSED`;
não foi adicionada uma licença sem decisão do proprietário.

SHA-256 do pacote: `EE7588F95704200C6DBC047EF64288E7CE4D1EF0F24F842CE895423FAB9788E2`.
`git diff --check` passou. T001–T037 estão marcadas: 37 de 37 tarefas concluídas.

| Ambiente | Editor/shell | Situação |
|---|---|---|
| Windows x64, processos locais | Node; cmd/PowerShell | Automação passou; não equivale a aceitação no editor |
| Windows, conta/VM descartável | VS Code 1.85/atual; cmd/PowerShell | Sucesso informado pelo usuário |
| Windows, conta/VM descartável | Cursor; cmd/PowerShell | Sucesso informado pelo usuário |
| macOS x64/arm64 | VS Code/Cursor; bash/zsh | Sucesso informado pelo usuário |
| Linux x64/arm64 | VS Code/Cursor; bash/zsh | Sucesso informado pelo usuário |
| SSH/WSL/devcontainer/web | VS Code/Cursor | Sucesso informado pelo usuário |

T037 encerrada por confirmação do usuário de execução bem-sucedida da matriz.
Os resultados automatizados permanecem documentados separadamente acima.

## Preparação

Usar VMs/contas descartáveis Windows/macOS/Linux com VS Code >=1.85 e Cursor desktop. Não remover ferramentas da conta pessoal. Preparar snapshots sem uv/Python/Specify, com CLI compatível e com incompatível. Ter rede às fontes oficiais, Node para testes e ferramentas de empacotamento. Para features/wiki, usar repositório fixture configurado. Agentes continuam pré-requisito separado.

Na raiz do repositório:

```text
npm test
npx @vscode/vsce package --allow-missing-repository
code --install-extension ./sdd-speckit-0.12.2.vsix --force
```

O nome corresponde à versão atual; substituir pelo VSIX gerado se mudar. Repetir com `cursor --install-extension <arquivo.vsix> --force`. Testar instalar.cmd/instalar.ps1 em Windows. Não é necessário publicar release.

## Automação esperada

npm test executa regressão e novos testes sem downloads/instalação real. Usar adapters simulados para rede/processos/probes/VS Code; processos reais apenas para disputar lock em pasta temporária.

Cobrir primeira tentativa, reutilização sem downloads, incompatibilidade, falhas por etapa, cancelamento antes/depois da saída do filho, reload, duas janelas, dois recuperadores, dono morto com filho vivo, liveness ambígua, JSON corrompido, PATH com espaços/Unicode, precedência de cópia externa, shell que redefine PATH, timeout/árvore de processos e fixture intacto. Assertar efeitos/resultados, não só strings.

## Aceitação manual

| Cenário | Procedimento | Esperado |
|---|---|---|
| Limpa — US1, FR-001/002/005 | Instalar VSIX e abrir janela vazia sem painel | Preparação automática de uv/Python/Specify sem administrador |
| Uso — FR-003/008 | Validar em novo terminal; init/integração explicitamente em fixture | Mesma cópia funcional nas ações e terminal; sucesso após validação |
| Existente — US2, FR-004 | Comparar caminho/versão/arquivos antes/depois | Sem downloads nem alterações |
| Incompatível | CLI antigo ou fixture sem integration; depois escolher Reparar | Não substitui automaticamente; cópia isolada após escolha |
| Reload/update — FR-011 | Reiniciar/atualizar extensão com CLI funcional | Probes sem reinstalação |
| Falha — US3 | Bloquear rede, escrita ou simular disco cheio | Causa/etapa/recuperação; reload não reinstala; retry após correção funciona |
| Cancelamento — FR-007/009 | Cancelar em download e uv; reiniciar | Filhos encerrados, sem sucesso nem retomada; retry funciona |
| Interrupção — FR-010 | Fechar host; repetir com filho vivo | Não duplica instalação; recuperação explícita quando segura |
| Concorrência — SC-005 | Duas janelas e VS Code+Cursor na mesma conta | Um instalador; cada janela valida resultado |
| Remoção — FR-011/012 | Remover cópia da VM; chamar ação dependente | Oferece reparo, sem alterar fixture |
| PATH — FR-008 | cmd/PowerShell/bash/zsh, terminal antigo/novo, profile que redefine PATH | Novo terminal funciona ou permanece pendente, sem falso ready |
| Remoto/web — FR-014 | SSH/WSL/devcontainer e VS Code web | Sem bootstrap fora de escopo; limitação informada; web não oferece execução Node |
| Projeto — FR-013, SC-004 | Comparar hashes/status durante sucesso/falha/cancelamento | Fixture intacto; árvores/wiki utilizáveis |

No novo terminal, executar três probes com saída zero:

```text
specify version
specify init --help
specify integration install --help
```

Conferir resolução por `Get-Command specify` (PowerShell), `where specify` (cmd) ou `command -v specify` (bash/zsh); comparar com diagnóstico e flags exigidas. Em fixture separado, executar explicitamente `specify init --here --integration claude --script ps` e `specify integration install codex --script ps --force`; em Unix substituir ps por sh. Esses comandos modificam o fixture e não fazem parte do bootstrap.

## Evidência

Registrar SO/arquitetura/editor/shell, versões uv/Python/Specify, origem, logs sem credenciais, estado, probes, downloads e máximo de instaladores simultâneos. SC-001 a SC-005 devem passar nos ambientes exercitados; declarar células não executadas. Inspecionar VSIX para confirmar módulos incluídos/testes excluídos e comparar README com comportamento. Nenhum teste de instalação real foi executado no planejamento.
