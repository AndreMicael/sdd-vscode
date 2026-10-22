<!--
Sync Impact Report
- Versão: (template vazio) → 1.0.0
- Princípios definidos: I. Português simples; II. Mudança mínima, sem dependências;
  III. Testado com node --test; IV. Seguro e reversível; V. Multi-agente e multiplataforma
- Seções adicionadas: Restrições técnicas e de entrega; Fluxo de desenvolvimento; Governança
- Seções removidas: nenhuma
- Templates: plan/spec/tasks leem a constituição em tempo de execução; nada a alterar
- TODOs: nenhum
-->
# SDD (Spec Kit) Constitution

## Core Principles

### I. Português simples

Toda interface, mensagem, comando, wiki e documentação voltada ao usuário MUST estar em
português do Brasil, em linguagem simples, sem exigir que a pessoa decore comandos.
Termos técnicos só aparecem quando inevitáveis e vêm explicados.
Razão: o público é quem está começando em SDD; o painel existe para tirar a fricção.

### II. Mudança mínima, sem dependências

O código MUST usar apenas Node.js e a API do VS Code, em JavaScript CommonJS, sem etapa de
build e sem pacotes npm em runtime. Cada feature faz a menor mudança que resolve o pedido
inteiro (YAGNI): sem abstração, opção ou configuração que ninguém pediu.
Razão: extensão pequena, fácil de revisar e de instalar a partir de um `.vsix`.

### III. Testado com node --test

Toda lógica nova não trivial (parser, leitura de specs, fluxo de passos, setup do Specify)
MUST vir com teste executável por `npm test` (`node --test`), em `test/` ou `test.js`.
Mudanças triviais de texto ou layout não exigem teste.
Razão: sem build nem framework, os testes são a única rede de segurança.

### IV. Seguro e reversível

A extensão MUST NOT apagar ou sobrescrever dados do usuário sem caminho de recuperação.
Instalações (uv, Python, specify-cli) MUST rodar sem administrador, no diretório de dados do
usuário, sem editar o PATH global nem perfis de shell. Downloads MUST usar HTTPS com
verificação TLS; nunca desligar certificados.
Razão: a extensão roda na máquina de outras pessoas e precisa ser confiável.

### V. Multi-agente e multiplataforma

Funcionalidades MUST funcionar com todos os agentes suportados (Claude Code, Cursor, Codex,
OpenCode, Antigravity) e em Windows, macOS e Linux. Quando algo for específico de um agente
ou sistema, isso MUST ser explícito e ter alternativa ou mensagem clara nos demais.
Razão: o valor do painel é ser o mesmo fluxo SDD independente da ferramenta.

## Restrições técnicas e de entrega

- Versão em semver no `package.json`; toda feature entregue faz bump (MINOR para recurso
  novo, PATCH para correção) e gera o `.vsix` publicado na Release do GitHub.
- Os artefatos de Spec Kit do próprio repositório (`specs/`, `.specify/`, skills) MUST ficar
  fora do pacote `.vsix`.
- Arquivos gerados pela extensão no projeto do usuário MUST ser previsíveis e documentados.

## Fluxo de desenvolvimento

- Cada feature nasce em uma branch `NNN-nome-curto` com sua pasta `specs/NNN-nome-curto/`
  (spec, plan, tasks) e chega à `main` por Pull Request.
- O PR MUST passar em `npm test` e citar as tarefas (`Tnnn`) que entrega.
- A revisão confere a aderência a esta constituição; complexidade extra MUST ser justificada
  no `plan.md`.

## Governance

Esta constituição prevalece sobre outras práticas do repositório. Emendas são feitas por PR
que altera este arquivo, explica o motivo e ajusta o número de versão:
MAJOR para remoção ou redefinição incompatível de princípio, MINOR para princípio ou seção
nova, PATCH para redação. Toda spec e todo plano MUST passar pela checagem de constituição
do Spec Kit; violações só entram com justificativa registrada no `plan.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-22 | **Last Amended**: 2026-10-22
