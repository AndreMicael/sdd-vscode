// @ts-check
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const lib = require("./lib");
const wiki = require("./wiki");

const PASSOS = {
  clarify: "Clarify (tirar dúvidas da spec)",
  plan: "Plan (plano técnico)",
  checklist: "Checklist (qualidade dos requisitos)",
  tasks: "Tasks (gerar tasks.md)",
  analyze: "Analyze (conferir consistência)",
  implement: "Implement (implementar)",
  converge: "Converge (o que falta)",
  taskstoclickup: "Enviar ao ClickUp",
};

const ICONES = {
  vazia: "circle-outline",
  spec: "note",
  plano: "list-tree",
  implementando: "sync",
  concluida: "pass-filled",
};

/** Todos os repositórios das pastas abertas, com e sem Spec Kit. */
function repos() {
  const vistos = new Set();
  return (vscode.workspace.workspaceFolders || [])
    .flatMap((f) => lib.repositorios(f.uri.fsPath))
    .filter((r) => !vistos.has(r.dir) && vistos.add(r.dir));
}

/** Só os que já têm Spec Kit (onde os /speckit-* funcionam). */
function raizes() {
  return repos().filter((r) => r.specKit).map((r) => r.dir);
}

// Cache por atualização da árvore: cada consulta roda vários comandos git.
const cacheOutras = new Map();
function outrasBranches(raiz) {
  if (!cacheOutras.has(raiz)) cacheOutras.set(raiz, lib.featuresOutrasBranches(raiz));
  return cacheOutras.get(raiz);
}

function itemRepo(r) {
  const item = new vscode.TreeItem(path.basename(r.dir), vscode.TreeItemCollapsibleState.Expanded);
  const n = r.specKit ? lib.listarFeatures(r.dir).length + outrasBranches(r.dir).length : 0;
  item.description = r.specKit ? `${n} feature${n === 1 ? "" : "s"}` : "sem Spec Kit";
  item.tooltip = r.dir;
  item.iconPath = new vscode.ThemeIcon(r.specKit ? "repo" : "warning");
  item.contextValue = r.specKit ? "repo" : "repoSemSpecKit";
  if (!r.specKit) item.collapsibleState = vscode.TreeItemCollapsibleState.None;
  return Object.assign(item, { tipo: "repo", raiz: r.dir, specKit: r.specKit });
}

function itemFeature(raiz, nome) {
  const dir = path.join(raiz, "specs", nome);
  const etapa = lib.etapa(dir);
  const atual = lib.featureAtual(raiz) === dir;
  const item = new vscode.TreeItem(nome, vscode.TreeItemCollapsibleState.Collapsed);
  item.description = etapa.rotulo + (atual ? " · atual" : "");
  item.tooltip = `${dir}\nPróximo passo: ${etapa.proximo ? PASSOS[etapa.proximo] : "—"}`;
  item.iconPath = new vscode.ThemeIcon(ICONES[etapa.id]);
  item.contextValue = "feature";
  return Object.assign(item, { tipo: "feature", raiz, dir, etapa });
}

function itemFeatureOutraBranch(raiz, feature) {
  const item = new vscode.TreeItem(feature.nome, vscode.TreeItemCollapsibleState.None);
  item.description = `${feature.etapa.rotulo} · em ${feature.ref}`;
  item.tooltip = "Esta feature esta em outra branch. Clique com o botao direito > Abrir branch para trabalhar nela.";
  item.iconPath = new vscode.ThemeIcon(feature.remota ? "cloud" : "git-branch");
  item.contextValue = "featureOutraBranch";
  return Object.assign(item, { tipo: "featureOutraBranch", raiz, nome: feature.nome, ref: feature.ref, remota: feature.remota });
}

function itensArquivos(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((d) => {
      const alvo = path.join(dir, d.name);
      if (d.isDirectory()) {
        const pasta = new vscode.TreeItem(d.name, vscode.TreeItemCollapsibleState.Collapsed);
        pasta.iconPath = vscode.ThemeIcon.Folder;
        return Object.assign(pasta, { tipo: "pasta", dir: alvo });
      }
      const arq = new vscode.TreeItem(vscode.Uri.file(alvo));
      arq.command = { command: "vscode.open", title: "Abrir", arguments: [vscode.Uri.file(alvo)] };
      if (d.name === "tasks.md") {
        const t = lib.contarTarefas(fs.readFileSync(alvo, "utf8"));
        arq.description = `${t.feitas}/${t.total}`;
      }
      return arq;
    });
}

class Arvore {
  constructor() {
    this.evento = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.evento.event;
  }
  atualizar() {
    cacheOutras.clear();
    this.evento.fire(undefined);
  }
  getTreeItem(e) {
    return e;
  }
  getChildren(e) {
    if (!e) return repos().map(itemRepo);
    if (e.tipo === "repo") {
      return [
        ...lib.listarFeatures(e.raiz).map((n) => itemFeature(e.raiz, n)),
        ...outrasBranches(e.raiz).map((f) => itemFeatureOutraBranch(e.raiz, f)),
      ];
    }
    if (e.tipo === "feature" || e.tipo === "pasta") return itensArquivos(e.dir);
    return [];
  }
}

/** Feature atual para a view "Onde estou": branch → feature.json → última em specs/. */
function featureStatus() {
  for (const raiz of raizes()) {
    const features = lib.listarFeatures(raiz);
    const branch = lib.branchAtual(raiz);
    const marcada = lib.featureAtual(raiz);
    const nome =
      (branch && features.includes(branch) ? branch : null) ||
      (marcada && features.includes(path.basename(marcada)) ? path.basename(marcada) : null) ||
      features[features.length - 1];
    if (nome) return { raiz, nome, dir: path.join(raiz, "specs", nome) };
  }
  return null;
}

const ARQUIVO_PASSO = { specify: "spec.md", plan: "plan.md", tasks: "tasks.md" };

const ICONES_TRILHA = {
  feito: "pass-filled",
  atual: "arrow-right",
  pendente: "circle-outline",
  opcional: "circle-large-outline",
};

class Status {
  constructor() {
    this.evento = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.evento.event;
  }
  atualizar() {
    this.evento.fire(undefined);
  }
  getTreeItem(e) {
    return e;
  }
  getChildren(e) {
    if (e) return [];
    const f = featureStatus();
    if (!f) return [];
    const branch = lib.branchAtual(f.raiz);
    const topo = new vscode.TreeItem(f.nome, vscode.TreeItemCollapsibleState.None);
    topo.iconPath = new vscode.ThemeIcon("git-branch");
    topo.description = path.basename(f.raiz) + (branch ? ` · branch ${branch}` : "");
    topo.contextValue = "featureStatus";
    Object.assign(topo, { raiz: f.raiz, dir: f.dir });
    const passos = lib.trilha(f.dir).map((p) => {
      const label = p.estado === "atual" ? `${p.titulo}  ← você está aqui` : p.titulo;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.description = p.explicacao;
      item.tooltip = p.explicacao;
      item.iconPath =
        p.estado === "atual"
          ? new vscode.ThemeIcon("arrow-right", new vscode.ThemeColor("charts.yellow"))
          : new vscode.ThemeIcon(ICONES_TRILHA[p.estado]);
      // Etapa feita com arquivo: abre o arquivo; as outras abrem o formulário do passo.
      if (p.estado === "feito" && ARQUIVO_PASSO[p.passo]) {
        item.command = {
          command: "vscode.open",
          title: "Abrir",
          arguments: [vscode.Uri.file(path.join(f.dir, ARQUIVO_PASSO[p.passo]))],
        };
      } else if (p.passo !== "specify") {
        item.command = {
          command: `sdd.${p.passo}`,
          title: p.titulo,
          arguments: [itemFeature(f.raiz, f.nome)],
        };
      }
      return item;
    });
    return [topo, ...passos];
  }
}

/** Abre um terminal no repositório e roda os comandos (o último costuma ser o agente). */
function terminal(raiz, dir, comandos) {
  const shell = vscode.env.shell;
  const term = vscode.window.createTerminal({
    name: `SDD: ${path.basename(dir || raiz)}`,
    cwd: raiz,
    // Mesmo shell usado para escapar as aspas em comandoAgente.
    shellPath: shell || undefined,
    // O Spec Kit usa esta variável para saber em qual feature trabalhar.
    env: dir ? { SPECIFY_FEATURE_DIRECTORY: dir } : undefined,
  });
  term.show();
  term.sendText(lib.juntar(comandos, shell));
}

const agenteConfig = () => vscode.workspace.getConfiguration("sdd").get("agente") || "claude";

/**
 * Chama a IA escolhida com o comando do Spec Kit (`passo` = specify, plan...).
 * Se a integração dessa IA ainda não está no repositório, oferece instalar e não roda.
 */
async function rodar(raiz, dir, passo, args, antes = [], id = agenteConfig()) {
  const a = lib.agente(id);
  if (!lib.integracoes(raiz).includes(a.integracao)) {
    const ok = await vscode.window.showWarningMessage(
      `${a.nome} ainda não tem os comandos do Spec Kit em ${path.basename(raiz)}. Instalar a integração agora?`,
      { modal: true },
      "Instalar",
    );
    if (ok !== "Instalar") return;
    // --force: algumas integrações (ex.: agy) não se declaram seguras para conviver com outras.
    terminal(raiz, null, [`specify integration install ${a.integracao} --script ps --force`]);
    vscode.window.showInformationMessage("Quando a instalação terminar, clique de novo para rodar o comando.");
    return;
  }
  terminal(raiz, dir, [...antes, lib.comandoAgente(a.exe, lib.invocacao(id, passo, args), vscode.env.shell)]);
}

/** Instala o Spec Kit no repositório (o init preserva uma constituição já existente). */
async function instalarSpecKit(raiz, id = agenteConfig()) {
  const a = lib.agente(id);
  const ok = await vscode.window.showWarningMessage(
    `Instalar o Spec Kit em ${path.basename(raiz)} para ${a.nome}? Ele cria .specify/ e os comandos /speckit-* no repositório.`,
    { modal: true },
    "Instalar",
  );
  if (ok !== "Instalar") return false;
  terminal(raiz, null, [`specify init --here --integration ${a.integracao} --script ps`]);
  vscode.window.showInformationMessage("Confirme no terminal. Quando terminar, o repositório aparece no painel.");
  return true;
}

async function escolherFeature(item) {
  if (item?.tipo === "feature") return item;
  const todas = raizes().flatMap((r) => lib.listarFeatures(r).map((n) => itemFeature(r, n)));
  if (!todas.length) {
    vscode.window.showInformationMessage("Nenhuma feature em specs/. Crie uma com \"Nova feature\".");
    return undefined;
  }
  const r = await vscode.window.showQuickPick(
    todas.map((f) => ({ label: path.basename(f.dir), description: f.etapa.rotulo, f })),
    { placeHolder: "Qual feature?" },
  );
  return r?.f;
}

function listaRepos() {
  return repos().map((r) => ({
    dir: r.dir,
    nome: path.basename(r.dir) + (r.specKit ? "" : " (sem Spec Kit)"),
    specKit: r.specKit,
  }));
}

class Formulario {
  constructor() {
    /** @type {vscode.WebviewView | undefined} */
    this.view = undefined;
    /** @type {object | undefined} */
    this.pendente = undefined;
  }

  /** @param {vscode.WebviewView} webviewView */
  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = htmlForm(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((m) => this.receber(m));
    this.enviarRepos();
    if (this.pendente) {
      webviewView.webview.postMessage(this.pendente);
      this.pendente = undefined;
    }
  }

  /** @param {object} msg */
  post(msg) {
    if (this.view) this.view.webview.postMessage(msg);
    else this.pendente = msg;
  }

  enviarRepos() {
    if (!this.view) return;
    this.view.webview.postMessage({
      tipo: "repos",
      repos: listaRepos(),
      agente: agenteConfig(),
    });
  }

  /** @param {string | undefined} raiz */
  async abrirNova(raiz) {
    this.post({ tipo: "nova", raiz: raiz || "" });
    await vscode.commands.executeCommand("sdd.form.focus");
  }

  /** @param {string} passo @param {{ raiz: string, dir: string }} f */
  async abrirPasso(passo, f) {
    const listaPadrao = vscode.workspace.getConfiguration("sdd").get("listaClickUp") || "";
    this.post({
      tipo: "passo",
      passo,
      rotulo: PASSOS[passo],
      feature: path.basename(f.dir),
      raiz: f.raiz,
      dir: f.dir,
      listaPadrao,
    });
    await vscode.commands.executeCommand("sdd.form.focus");
  }

  /** @param {any} m */
  async receber(m) {
    if (m.tipo === "agente") {
      await vscode.workspace.getConfiguration("sdd").update("agente", m.agente, vscode.ConfigurationTarget.Global);
      return;
    }
    if (m.tipo === "criar") {
      const r = repos().find((x) => x.dir === m.raiz);
      if (!r) return;
      if (!r.specKit) {
        await instalarSpecKit(r.dir, m.agente);
        return;
      }
      const s = lib.slug(m.nome || "");
      const antes = s ? [`git switch -c ${lib.proximoNumero(lib.listarFeatures(r.dir))}-${s}`] : [];
      await rodar(r.dir, null, "specify", m.descricao, antes, m.agente);
      return;
    }
    if (m.tipo === "executar") {
      await rodar(m.raiz, m.dir, m.passo, m.args, [], m.agente);
    }
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SELO = { feito: "✔", atual: "➜", pendente: "○", opcional: "◌" };

/** Arquivo relativo no início de um item de `gera`, se existir em dir. */
function arquivoGera(dir, texto) {
  const m = /^([\w./-]+)/.exec(texto);
  if (!m) return null;
  let rel = m[1].replace(/\/$/, "");
  try {
    return rel && fs.statSync(path.join(dir, rel)).isFile() ? rel : null;
  } catch {
    return null;
  }
}

/** Arquivos da feature até 2 níveis (pasta + um subnível). */
function listarArquivosWiki(dir, base = dir, nivel = 0) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .flatMap((d) => {
        const full = path.join(dir, d.name);
        const rel = path.relative(base, full).split(path.sep).join("/");
        if (d.isDirectory()) return nivel < 1 ? listarArquivosWiki(full, base, nivel + 1) : [];
        return [rel];
      });
  } catch {
    return [];
  }
}

/** @type {Map<string, vscode.WebviewPanel>} */
const paineisWiki = new Map();

/** @param {vscode.Webview} webview @param {{ raiz: string, nome: string, dir: string }} f */
function htmlWiki(webview, f) {
  const nonce = crypto.randomBytes(16).toString("base64");
  const trilha = lib.trilha(f.dir);
  const atual = trilha.find((p) => p.estado === "atual");
  const progresso = atual
    ? `Passo ${trilha.indexOf(atual) + 1} de 7 — ${atual.titulo}`
    : "Concluída";
  const branch = lib.branchAtual(f.raiz) || "—";
  const wAtual = atual ? wiki.PASSOS[atual.passo] : null;

  const liGera = (texto) => {
    const arq = arquivoGera(f.dir, texto);
    if (!arq) return `<li>${esc(texto)}</li>`;
    const resto = texto.slice(arq.length);
    return `<li><a href="#" data-abrir="${esc(arq)}">${esc(arq)}</a>${esc(resto)}</li>`;
  };

  const blocoPasso = (p) => {
    const w = wiki.PASSOS[p.passo];
    if (!w) return "";
    const aberto = p.estado === "atual" ? " open" : "";
    return `<details class="passo ${esc(p.estado)}"${aberto}>
<summary><span class="selo">${SELO[p.estado] || "○"}</span> <strong>${esc(p.titulo)}</strong> — ${esc(w.resumo)}</summary>
<div class="corpo">
<p>${esc(w.explicacao)}</p>
<h4>O que gera</h4><ul>${w.gera.map(liGera).join("")}</ul>
<h4>Quando usar</h4><p>${esc(w.quando)}</p>
<h4>Dicas</h4><ul>${w.dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
<h4>Erros comuns</h4><ul>${w.erros.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
<p>Comando: <code>/${esc(w.comando)}</code></p>
${p.passo === "specify" ? "" : `<button type="button" data-executar="${esc(p.passo)}">Executar este passo</button>`}
</div></details>`;
  };

  let tarefasHtml = "";
  const tasksPath = path.join(f.dir, "tasks.md");
  if (fs.existsSync(tasksPath)) {
    const texto = fs.readFileSync(tasksPath, "utf8");
    const cont = lib.contarTarefas(texto);
    const itens = [];
    const re = /^\s*- \[([ xX])\] (T\d{3,}.*)$/gm;
    let m;
    while ((m = re.exec(texto))) {
      itens.push(`<li>${m[1] !== " " ? "☑" : "☐"} ${esc(m[2])}</li>`);
    }
    tarefasHtml = `<section><h2>Tarefas</h2>
<p>${cont.feitas}/${cont.total} feitas</p>
<ul class="tarefas">${itens.join("")}</ul></section>`;
  }

  const arquivos = listarArquivosWiki(f.dir)
    .map((a) => `<li><a href="#" data-abrir="${esc(a)}">${esc(a)}</a></li>`)
    .join("");

  const glossario = wiki.GLOSSARIO.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("");

  const cardAtual = atual && wAtual
    ? `<section class="atual"><h2>Onde você está</h2>
<p><strong>${esc(atual.titulo)}</strong></p>
<p>${esc(wAtual.resumo)}</p>
<button type="button" data-executar="${esc(atual.passo)}">Executar ${esc(atual.titulo)}</button>
</section>`
    : `<section class="atual"><h2>Onde você está</h2><p>Fluxo concluído — não há passo pendente.</p></section>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 16px;
    line-height: 1.5;
  }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.4em; margin: 0 0 4px; }
  h2 { font-size: 1.15em; margin: 28px 0 10px; border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border)); padding-bottom: 4px; }
  h4 { margin: 12px 0 4px; font-size: .95em; }
  .meta { opacity: .85; margin: 0 0 8px; }
  .barra {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 6px 10px;
    border-radius: 4px;
    display: inline-block;
    margin-bottom: 8px;
  }
  .atual {
    background: var(--vscode-editor-inactiveSelectionBackground, var(--vscode-input-background));
    border: 1px solid var(--vscode-focusBorder, var(--vscode-input-border));
    border-radius: 6px;
    padding: 12px 14px;
    margin: 16px 0;
  }
  .atual h2 { margin-top: 0; border: none; }
  details.passo {
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    margin: 8px 0;
    padding: 0 10px 8px;
    background: var(--vscode-sideBar-background, transparent);
  }
  details.passo.atual { border-color: var(--vscode-focusBorder, var(--vscode-input-border)); }
  summary { cursor: pointer; padding: 10px 0; }
  .selo { margin-right: 4px; }
  .corpo { padding-bottom: 6px; }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    cursor: pointer;
    font-family: inherit;
    margin-top: 8px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  a { color: var(--vscode-textLink-foreground); }
  code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textCodeBlock-background, var(--vscode-input-background));
    padding: 1px 4px;
    border-radius: 3px;
  }
  ul { padding-left: 1.2em; }
  dl { margin: 0; }
  dt { font-weight: 600; margin-top: 10px; }
  dd { margin: 2px 0 0 1em; opacity: .9; }
  .tarefas { list-style: none; padding-left: 0; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(f.nome)}</h1>
    <p class="meta">Repositório: ${esc(path.basename(f.raiz))} · Branch: ${esc(branch)}</p>
    <div class="barra">${esc(progresso)}</div>
  </header>
  ${cardAtual}
  <section>
    <h2>O fluxo, passo a passo</h2>
    ${trilha.map(blocoPasso).join("")}
  </section>
  ${tarefasHtml}
  <section>
    <h2>Arquivos da feature</h2>
    <ul>${arquivos || "<li>(nenhum arquivo)</li>"}</ul>
  </section>
  <section>
    <h2>Glossário</h2>
    <dl>${glossario}</dl>
  </section>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-abrir]");
  if (a) { e.preventDefault(); vscode.postMessage({ tipo: "abrir", arquivo: a.getAttribute("data-abrir") }); return; }
  const b = e.target.closest("[data-executar]");
  if (b) { e.preventDefault(); vscode.postMessage({ tipo: "executar", passo: b.getAttribute("data-executar") }); }
});
</script>
</body>
</html>`;
}

/** @param {any} item */
async function abrirWiki(item) {
  let f =
    item?.tipo === "feature" ? item : item?.raiz && item?.dir ? item : featureStatus();
  if (!f) f = await escolherFeature(undefined);
  if (!f) return;
  const feat = { raiz: f.raiz, nome: f.nome || path.basename(f.dir), dir: f.dir };

  const existente = paineisWiki.get(feat.dir);
  if (existente) {
    existente.reveal(vscode.ViewColumn.Active);
    existente.webview.html = htmlWiki(existente.webview, feat);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "sdd.wiki",
    `Wiki: ${feat.nome}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  paineisWiki.set(feat.dir, panel);
  panel.onDidDispose(() => paineisWiki.delete(feat.dir));
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.tipo === "executar") {
      // Não existe sdd.specify: especificar é criar a feature pelo formulário.
      if (m.passo === "specify") {
        await vscode.commands.executeCommand("sdd.novaFeature");
        return;
      }
      await vscode.commands.executeCommand("sdd." + m.passo, itemFeature(feat.raiz, feat.nome));
      return;
    }
    if (m.tipo === "abrir" && m.arquivo) {
      const alvo = path.resolve(feat.dir, m.arquivo);
      if (!alvo.startsWith(feat.dir + path.sep)) return;
      await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(alvo));
    }
  });
  panel.webview.html = htmlWiki(panel.webview, feat);
}

function atualizarPaineisWiki() {
  for (const [dir, panel] of paineisWiki) {
    if (!fs.existsSync(dir)) continue;
    const feat = { raiz: path.dirname(path.dirname(dir)), nome: path.basename(dir), dir };
    panel.webview.html = htmlWiki(panel.webview, feat);
  }
}

/** @param {vscode.Webview} webview */
function htmlForm(webview) {
  const nonce = crypto.randomBytes(16).toString("base64");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body {
    font-family: var(--vscode-font-family);
    padding: 8px;
    margin: 0;
    color: var(--vscode-foreground);
  }
  label { display: block; margin: 10px 0 4px; }
  select, input, textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 6px;
    font-family: inherit;
  }
  textarea { resize: vertical; }
  .botoes { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    cursor: pointer;
    font-family: inherit;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.sec {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-input-border);
  }
  #erro { color: var(--vscode-errorForeground); margin-top: 8px; min-height: 1.2em; }
  h3 { margin: 0 0 8px; font-size: 1em; font-weight: 600; }
  .oculto { display: none; }
</style>
</head>
<body>
  <label for="agente">IA</label>
  <select id="agente">
    ${Object.entries(lib.AGENTES).map(([id, a]) => `<option value="${id}">${a.nome}</option>`).join("")}
  </select>
  <div id="modo-nova">
    <h3>Nova feature</h3>
    <label for="repo">Repositório</label>
    <select id="repo"></select>
    <label for="descricao">O que você quer construir e por quê? (sem falar de tecnologia)</label>
    <textarea id="descricao" rows="5" placeholder="ex.: O cidadão precisa baixar o comprovante do PIX de entrada depois de pago"></textarea>
    <label for="branch">Nome curto da branch (opcional)</label>
    <input id="branch" type="text" placeholder="ex.: comprovante-pix">
    <div class="botoes"><button id="criar" type="button">Criar feature</button></div>
  </div>
  <div id="modo-passo" class="oculto">
    <h3 id="titulo-passo"></h3>
    <p id="nome-feature" style="margin:0 0 8px;opacity:.85"></p>
    <label for="args" id="label-args">Instruções extras (opcional)</label>
    <textarea id="args" rows="5"></textarea>
    <div id="bloco-lista" class="oculto">
      <label for="lista">Lista do ClickUp</label>
      <input id="lista" type="text">
    </div>
    <div class="botoes">
      <button id="executar" type="button">Executar</button>
      <button id="cancelar" type="button" class="sec">Cancelar</button>
    </div>
  </div>
  <div id="erro"></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const el = (id) => document.getElementById(id);
let repos = [];
let passoAtual = null;
let featureAtual = null;
let agenteTocado = false;

function erro(msg) { el("erro").textContent = msg || ""; }

function mostrarNova(raiz) {
  el("modo-nova").classList.remove("oculto");
  el("modo-passo").classList.add("oculto");
  erro("");
  preencherRepos(raiz || el("repo").value);
}

function preencherRepos(selecionado) {
  const sel = el("repo");
  const atual = selecionado || sel.value;
  sel.innerHTML = "";
  for (const r of repos) {
    const o = document.createElement("option");
    o.value = r.dir;
    o.textContent = r.nome;
    sel.appendChild(o);
  }
  if (atual && [...sel.options].some((o) => o.value === atual)) sel.value = atual;
}

function mostrarPasso(m) {
  el("modo-nova").classList.add("oculto");
  el("modo-passo").classList.remove("oculto");
  erro("");
  passoAtual = m.passo;
  featureAtual = { raiz: m.raiz, dir: m.dir };
  el("titulo-passo").textContent = m.rotulo;
  el("nome-feature").textContent = m.feature;
  const clickup = m.passo === "taskstoclickup";
  el("bloco-lista").classList.toggle("oculto", !clickup);
  el("args").classList.toggle("oculto", clickup);
  el("label-args").classList.toggle("oculto", clickup);
  el("args").value = "";
  el("args").placeholder = m.passo === "implement" ? "ex.: só a Fase 1" : "Enter para seguir sem instruções";
  el("lista").value = m.listaPadrao || "";
}

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.tipo === "repos") {
    repos = m.repos || [];
    preencherRepos();
    if (!agenteTocado && m.agente) el("agente").value = m.agente;
  } else if (m.tipo === "nova") {
    mostrarNova(m.raiz);
  } else if (m.tipo === "passo") {
    mostrarPasso(m);
  }
});

function criar() {
  const descricao = el("descricao").value.trim();
  if (!descricao) { erro("Descreva o que você quer construir."); return; }
  erro("");
  vscode.postMessage({ tipo: "criar", raiz: el("repo").value, descricao, nome: el("branch").value, agente: el("agente").value });
}

function executar() {
  if (!passoAtual || !featureAtual) return;
  const args = passoAtual === "taskstoclickup" ? el("lista").value : el("args").value;
  vscode.postMessage({ tipo: "executar", passo: passoAtual, raiz: featureAtual.raiz, dir: featureAtual.dir, args, agente: el("agente").value });
}

el("agente").addEventListener("change", () => {
  agenteTocado = true;
  vscode.postMessage({ tipo: "agente", agente: el("agente").value });
});
el("criar").addEventListener("click", criar);
el("executar").addEventListener("click", executar);
el("cancelar").addEventListener("click", () => mostrarNova());
el("descricao").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); criar(); }
});
el("args").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); executar(); }
});
</script>
</body>
</html>`;
}

async function executarPasso(passo, item, form) {
  const f = await escolherFeature(item);
  if (!f) return;
  if (passo === "analyze") {
    await rodar(f.raiz, f.dir, "analyze");
    return;
  }
  await form.abrirPasso(passo, f);
}

async function excluirFeature(item, arvore, status, form) {
  let f = item?.tipo === "feature" ? item : item?.raiz && item?.dir ? item : undefined;
  if (!f) f = await escolherFeature(undefined);
  if (!f) return;

  const dir = path.resolve(f.dir);
  const raiz = path.resolve(f.raiz);
  const specs = path.join(raiz, "specs");
  const nome = path.basename(dir);
  if (!dir.startsWith(specs + path.sep) || !/^\d+-/.test(nome)) {
    vscode.window.showErrorMessage("Feature inválida para exclusão.");
    return;
  }

  const branch = lib.branchAtual(raiz);
  // Branch solta em refs/heads ou compactada em packed-refs (depois de git gc).
  const packed = path.join(raiz, ".git", "packed-refs");
  const existeBranch =
    fs.existsSync(path.join(raiz, ".git", "refs", "heads", nome)) ||
    (fs.existsSync(packed) && fs.readFileSync(packed, "utf8").split(/\r?\n/).some((l) => l.endsWith(" refs/heads/" + nome)));
  const branchAtual = branch === nome;
  const podeApagarBranch = existeBranch && !branchAtual && /^[\w.-]+$/.test(nome);
  let texto = `Excluir a feature ${nome}? A pasta specs/${nome} vai para a lixeira (da para recuperar).`;
  if (branchAtual) {
    texto += ` Voce esta na branch ${nome}; ela nao sera apagada (troque de branch antes, se quiser apaga-la).`;
  }
  const excluirComBranch = "Excluir pasta e branch";
  const escolha = await vscode.window.showWarningMessage(
    texto,
    { modal: true },
    "Excluir pasta",
    ...(podeApagarBranch ? [excluirComBranch] : []),
  );
  if (!escolha) return;

  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(dir), { recursive: true, useTrash: true });
  } catch (e) {
    vscode.window.showErrorMessage(`Não foi possível excluir a feature ${nome}: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  paineisWiki.get(dir)?.dispose();
  if (escolha === excluirComBranch) {
    terminal(raiz, null, [`git branch -D ${nome}`]);
  }
  arvore.atualizar();
  status.atualizar();
  form.enviarRepos();
  vscode.window.showInformationMessage(`Feature ${nome} excluida.`);
}

/** @param {vscode.ExtensionContext} ctx */
function activate(ctx) {
  const arvore = new Arvore();
  const status = new Status();
  const form = new Formulario();
  let espera;
  const atualizar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      arvore.atualizar();
      status.atualizar();
      form.enviarRepos();
      atualizarPaineisWiki();
    }, 300);
  };
  const vigia = vscode.workspace.createFileSystemWatcher(
    "**/{specs/**,.specify/feature.json,.specify/init-options.json,.git/HEAD,.git/refs/**,.git/packed-refs}",
  );
  vigia.onDidCreate(atualizar);
  vigia.onDidChange(atualizar);
  vigia.onDidDelete(atualizar);

  ctx.subscriptions.push(
    vigia,
    vscode.window.registerTreeDataProvider("sdd.features", arvore),
    vscode.window.registerTreeDataProvider("sdd.status", status),
    vscode.window.registerWebviewViewProvider("sdd.form", form, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("sdd.atualizar", () => {
      arvore.atualizar();
      status.atualizar();
      form.enviarRepos();
    }),
    vscode.commands.registerCommand("sdd.abrirBranch", async (item) => {
      // Remota: git switch <nome> cria a local rastreando origin/<nome>. Local: o nome exato da branch.
      const alvo = item?.remota ? item.nome : item?.ref;
      if (!item?.raiz || !alvo || !/^[\w./-]+$/.test(alvo)) return;
      const ok = await vscode.window.showInformationMessage(
        `Trocar para a branch ${alvo}? Alteracoes nao commitadas vao junto (ou o git recusa se houver conflito).`,
        { modal: true },
        "Trocar",
      );
      if (ok === "Trocar") terminal(item.raiz, null, [`git switch ${alvo}`]);
    }),
    vscode.commands.registerCommand("sdd.buscarEquipe", async () => {
      const lista = repos();
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Buscando branches da equipe..." },
        async () => {
          await Promise.all(lista.map((repo) => new Promise((resolve) => {
            execFile("git", ["fetch", "--prune"], { cwd: repo.dir, timeout: 60000, windowsHide: true }, (erro) => {
              if (erro) vscode.window.showWarningMessage(`Nao foi possivel buscar branches em ${path.basename(repo.dir)}.`);
              resolve();
            });
          })));
        },
      );
      atualizar();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(atualizar),
    vscode.commands.registerCommand("sdd.instalarSpecKit", (item) => item?.raiz && instalarSpecKit(item.raiz)),
    vscode.commands.registerCommand("sdd.novaFeature", async (item) => {
      if (!repos().length) {
        vscode.window.showWarningMessage("Nenhum repositório git na pasta aberta.");
        return;
      }
      await form.abrirNova(item?.tipo === "repo" ? item.raiz : undefined);
    }),
    vscode.commands.registerCommand("sdd.proximo", async (item) => {
      const f = await escolherFeature(item);
      if (!f) return;
      if (!f.etapa.proximo) return vscode.window.showInformationMessage("Esta feature ainda não tem spec.md.");
      executarPasso(f.etapa.proximo, f, form);
    }),
    vscode.commands.registerCommand("sdd.wiki", (item) => abrirWiki(item)),
    vscode.commands.registerCommand("sdd.excluirFeature", (item) => excluirFeature(item, arvore, status, form)),
    ...Object.keys(PASSOS).map((p) => vscode.commands.registerCommand(`sdd.${p}`, (item) => executarPasso(p, item, form))),
  );
}

module.exports = { activate, deactivate() {} };
