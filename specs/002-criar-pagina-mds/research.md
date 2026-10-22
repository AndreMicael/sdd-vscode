# Research: Página navegável dos documentos Markdown

## 1. Conversão de Markdown em HTML

- **Decision**: usar o comando embutido do VS Code `markdown.api.render` (markdown-it da extensão nativa
  de Markdown), chamado em `extension.js` e passado como função para `site.js`.
- **Rationale**: o projeto não tem dependências npm; o renderizador já vem com o editor e trata títulos,
  tabelas, listas, código e links. Caixas `- [ ]`/`- [x]`/`- [X]` não viram checkbox nele, então `site.js`
  troca `<li>[ ]`/`<li>[x]`/`<li>[X]` por `<input type="checkbox" disabled>` com uma regex (em bloco de
  código o texto sai escapado, sem `<li>`, então a regex não o alcança).
- Se o comando não existir (extensão Markdown nativa desativada), a geração para com erro antes de
  apagar o site anterior.
- **Alternatives considered**: `marked`/`markdown-it` como dependência (passaria a empacotar
  `node_modules`, sem ganho); parser próprio (código demais para tabelas e listas aninhadas).

## 2. Funcionar sem servidor (`file://`)

- **Decision**: uma página `.html` completa por documento, com menu e CSS embutidos; a busca lê um
  `busca.js` que define `window.SDD_BUSCA = [...]` carregado por `<script src>`.
- **Rationale**: `fetch` de JSON local é bloqueado em `file://`; `<script src>` relativo funciona.
  Páginas completas (sem roteador JS) dão endereço próprio e botão Voltar de graça (FR-004).
- **Alternatives considered**: SPA com hash routes (precisa embutir todo o conteúdo em JS e reimplementar
  rolagem/âncoras); gerador tipo Docusaurus (Node + build, contraria FR-016 e "sem dependência").

## 3. Endereços e acentos

- **Decision**: o caminho da página espelha o arquivo: `specs/<feature>/<rel>.md` →
  `sdd-site/<feature>/<rel>.html`; constituição → `sdd-site/constituicao.html`. Nome de arquivo mantém
  os acentos; os `href` usam `encodeURIComponent` em cada segmento (escapa também `#`, `?`, `&`).
- **Rationale**: o caminho é previsível e os links relativos entre `.md` viram links relativos entre
  `.html` só trocando a extensão. Sistemas de arquivos atuais e navegadores lidam com UTF-8 no nome.
- **Alternatives considered**: slug sem acento (pode colidir `ação.md` com `acao.md` e esconde o nome real).

## 4. Links relativos

- **Decision**: no HTML gerado, para cada atributo `href` (precedido de espaço, para não pegar o
  `data-href` que o VS Code acrescenta) relativo terminado em `.md` (com ou sem `#âncora`),
  resolver a partir da pasta do arquivo de origem. Se o destino estiver na lista de documentos, trocar
  por `.html` relativo; se não, apontar para `nao-encontrado.html?doc=<caminho>`, que mostra o caminho
  pedido e o menu (FR-006). Links externos e não-`.md` ficam como estão.
- **Rationale**: atende FR-005/FR-006 e o caso de link para outra pasta, com uma única passada de regex
  sobre os `href`.

## 5. Índice de títulos (TOC)

- **Decision**: depois de renderizar, percorrer `<h2>`–`<h4>` com regex, dar `id` (slug do texto, com
  sufixo `-2`, `-3` em repetidos) se ainda não tiver, e montar a lista do índice ao lado do conteúdo.
- **Rationale**: não depende de o renderizador gerar `id`; `h1` é o título da página e fica fora.

## 6. Tipo do documento e explicação

- **Decision**: reaproveitar `wiki.PASSOS[*].gera`: o tipo de um arquivo é o passo cujo item de `gera`
  começa pelo caminho relativo dele (`spec.md`, `plan.md`, `research.md`, `data-model.md`,
  `quickstart.md`, `tasks.md`, `checklists/requirements.md`) ou pela pasta (`contracts/`). A caixa mostra
  `resumo` (o que é), o passo/comando (quem gera) e `quando`. Sem correspondência → sem caixa (FR-009).
- **Rationale**: nenhuma tabela nova; se a wiki mudar, o site acompanha. Um teste garante que os 7
  arquivos conhecidos têm tipo, para uma reescrita de `gera` não apagar a explicação em silêncio (SC-003).
- **Alternatives considered**: mapa próprio nome→explicação (duplicaria `wiki.js`).

## 7. Passo atual na página inicial

- **Decision**: `lib.trilha(dir)` — o item com `estado === "atual"` dá o título do passo (ex.:
  "3. Planejar"). `trilha` sempre marca um passo como atual (no fim, "7. Fechar"). Mesma lógica da
  Wiki da feature (`htmlWiki`).

## 8. Busca

- **Decision**: `busca.js` com `{ titulo, url, texto }` por documento (texto = Markdown sem marcação,
  em minúsculas e sem acento). O termo digitado passa pela mesma normalização, então "codigo" acha
  "código". Caixa de busca no topo do menu; filtra por `includes` e lista os títulos com link.
  Sem resultado → "Nenhum documento encontrado".
- **Rationale**: centenas de `.md` cabem em poucos MB; busca linear é instantânea nessa escala.
  `shortcut: busca linear por substring, trocar por índice invertido se passar de alguns MB`.
- **Alternatives considered**: lunr/minisearch (dependência, desnecessária nessa escala).

## 9. Regerar e apagar páginas antigas

- **Decision**: apagar `sdd-site/` inteira (`fs.rmSync(..., { recursive: true, force: true })`) antes
  de gravar. Só apagar se a pasta não existir ou contiver o marcador `sdd-site/.gerado-pelo-sdd`; caso
  contrário, avisar e não gerar.
- **Rationale**: FR-012 (arquivos apagados somem) sem diff incremental; o marcador evita apagar uma
  pasta do usuário que por acaso tenha o mesmo nome.

## 10. Segurança do HTML

- **Decision**: os títulos, nomes de arquivo e trechos de busca entram escapados (função `esc` já usada
  em `extension.js`). O HTML vindo do renderizador é usado como está.
- **Rationale**: o conteúdo é do próprio repositório (Assumptions da spec). Risco aceito: HTML cru
  (inclusive `<script>`) escrito num `.md` roda no site gerado. Quem publicar o site publica o que está
  nos `.md` do repositório; sanitizar fica para quando o site for exposto a conteúdo de terceiros.

## 11. Ação no painel

- **Decision**: comando `sdd.gerarSite` com ícone no título da view `sdd.features` e na paleta. Com
  vários repositórios abertos, perguntar qual (`showQuickPick`, como os comandos que já fazem isso);
  ao terminar, `vscode.env.openExternal(Uri.file(sdd-site/index.html))` (FR-017).
