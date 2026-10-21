// @ts-check
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const lib = require("./lib");

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

function itemRepo(r) {
  const item = new vscode.TreeItem(path.basename(r.dir), vscode.TreeItemCollapsibleState.Expanded);
  const n = r.specKit ? lib.listarFeatures(r.dir).length : 0;
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
    this.evento.fire(undefined);
  }
  getTreeItem(e) {
    return e;
  }
  getChildren(e) {
    if (!e) return repos().map(itemRepo);
    if (e.tipo === "repo") return lib.listarFeatures(e.raiz).map((n) => itemFeature(e.raiz, n));
    if (e.tipo === "feature" || e.tipo === "pasta") return itensArquivos(e.dir);
    return [];
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

/** @param {vscode.ExtensionContext} ctx */
function activate(ctx) {
  const arvore = new Arvore();
  const form = new Formulario();
  let espera;
  const atualizar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      arvore.atualizar();
      form.enviarRepos();
    }, 300);
  };
  const vigia = vscode.workspace.createFileSystemWatcher("**/{specs/**,.specify/feature.json,.specify/init-options.json}");
  vigia.onDidCreate(atualizar);
  vigia.onDidChange(atualizar);
  vigia.onDidDelete(atualizar);

  ctx.subscriptions.push(
    vigia,
    vscode.window.registerTreeDataProvider("sdd.features", arvore),
    vscode.window.registerWebviewViewProvider("sdd.form", form, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand("sdd.atualizar", () => {
      arvore.atualizar();
      form.enviarRepos();
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
    ...Object.keys(PASSOS).map((p) => vscode.commands.registerCommand(`sdd.${p}`, (item) => executarPasso(p, item, form))),
  );
}

module.exports = { activate, deactivate() {} };
