# Research: Ativar skills do Claude na caixa de ação

Nenhum item ficou "NEEDS CLARIFICATION" no Technical Context. A base (`sdd.orquestracao`, `promptOrquestrado`, `skillInstalada`, `instalarOrq`, seletor na webview) já existe desde o commit de orquestração; o gap é a ativação confiável e os fluxos da spec clarificada.

## 1. Por que a seleção na caixa “não ativa” a skill (FR-002, FR-004)

- **Decision**: Na mensagem `executar` (e `criar`, se um dia for elegível), a webview envia `orquestracao: el("orquestracao").value` junto com `agente`. `rodar()` usa esse valor quando vier na chamada; se não vier (comandos da paleta / menus), lê `sdd.orquestracao` como hoje. Antes de montar o prompt orquestrado, sincroniza a config global com o valor efetivo escolhido (sem apagar preferência no fluxo “Rodar sem orquestração”).
- **Rationale**: Hoje o `change` do select só faz `update` assíncrono da config, e `executar` não manda o modo. Se a pessoa escolhe `/orq` e clica Executar logo em seguida, `rodar` ainda pode ler `desligada` — bate com o relato “só o nome, não ativa”. Passar o valor da caixa no momento do envio cumpre o edge case da spec e FR-004.
- **Alternatives considered**: Esperar o `update` terminar no handler do select (ainda falha se Executar vier antes); ler só da config (estado atual, frágil); gravar no `vscode.getState()` da webview (duplica fonte da verdade).

## 2. Como a skill entra na sessão do Claude (FR-010, SC-001)

- **Decision**: Manter `promptOrquestrado(modo, prompt)` prefixando `/${modo}` no prompt enviado a `claude '<prompt>'` (sessão interativa) ou via `sendText` quando a TUI já está aberta. Não usar `claude -p`.
- **Rationale**: Slash skills expandem no modo interativo; no `-p` o `/nome` vira texto literal (issue anthropics/claude-code#38505). A extensão já abre TUI interativa — o prefixo `/orq` / `/orq-lazy` é o mecanismo correto. FR-010 exige também confirmação explícita na UI ao iniciar (hoje inexistente): `showInformationMessage` do tipo “Aplicando /orq neste passo…” imediatamente antes de abrir/enviar o terminal.
- **Alternatives considered**: `--append-system-prompt-file` com o SKILL.md (hack de `-p`, frágil com permissões); colar o corpo da skill no prompt (caro e diverge do pacote); só instrução em linguagem natural sem `/` (não é invocação de skill).

## 3. Fluxo “skill não instalada” e pós-instalação (FR-006, FR-007, FR-011, FR-012)

- **Decision**: Manter o modal atual (Instalar | Rodar sem orquestração | cancelar). Origem fixa: `https://github.com/AndreMicael/orq-skill` via `instalarOrq()`. Após instalação bem-sucedida, **novo** modal: “Rodar agora com skill” | “Depois”. “Rodar agora” segue com `promptOrquestrado`; “Depois” retorna sem abrir/enviar o passo. “Rodar sem orquestração” executa sem prefixo e **não** chama `update` de `sdd.orquestracao`.
- **Rationale**: Spec clarificada exige a pergunta pós-install; o código atual continua o passo em silêncio após instalar. A mensagem “valem nas próximas sessões” fica enganosa se “Rodar agora” for escolhido — ajustar o texto do sucesso da instalação para não contradizer (skills em disco; Claude novo ou sessão que já enxerga `~/.claude/skills`).
- **Alternatives considered**: Sempre rodar após instalar (comportamento atual, viola FR-007); mudar preferência para `desligada` ao pular (viola FR-012).

## 4. Passos elegíveis e IA ≠ Claude (FR-005, FR-009)

- **Decision**: Sem mudança de regra: `PASSOS_ORQ = plan|tasks|analyze|implement|converge`; bloco de orquestração só visível com `agente === "claude"`; fora disso ou fora da lista, não prefixar skill.
- **Rationale**: Já alinhado à UI e às Assumptions da spec.
- **Alternatives considered**: Ampliar elegíveis (fora de escopo); esconder só o select mas ainda ler config (confundiria).

## 5. Preferência persistente (FR-008)

- **Decision**: Continuar `sdd.orquestracao` + `sdd.agente` em ConfigurationTarget.Global; webview hidrata via `enviarRepos()`.
- **Rationale**: Já cobre reabrir a caixa / recarregar a janela.
- **Alternatives considered**: workspace settings (misturaria por repo sem pedido).

## 6. Testes

- **Decision**: Estender `node --test` só onde a lógica for pura/extraível (ex.: helper que decide se aplica orquestração / qual prompt final dado `{ id, passo, modo, instalada }`). Fluxos de modal e terminal ficam no [quickstart.md](quickstart.md).
- **Rationale**: Mesmo padrão da feature 001; `promptOrquestrado` / `skillInstalada` / `PASSOS_ORQ` já têm testes.
- **Alternatives considered**: Teste de webview (pesado para o ganho); sem teste novo (regra de decisão do modo na execução merece um assert).
