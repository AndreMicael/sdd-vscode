// @ts-check
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
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

/** Chama o agente com o comando do Spec Kit. */
function rodar(raiz, dir, prompt, antes = []) {
  const usarCursor = vscode.workspace.getConfiguration("sdd").get("agente") === "cursor";
  terminal(raiz, dir, [...antes, lib.comandoAgente(usarCursor ? "agent" : "claude", prompt, vscode.env.shell)]);
}

/** Instala o Spec Kit no repositório (o init preserva uma constituição já existente). */
async function instalarSpecKit(raiz) {
  const ok = await vscode.window.showWarningMessage(
    `Instalar o Spec Kit em ${path.basename(raiz)}? Ele cria .specify/ e .claude/skills/ no repositório.`,
    { modal: true },
    "Instalar",
  );
  if (ok !== "Instalar") return false;
  const usarCursor = vscode.workspace.getConfiguration("sdd").get("agente") === "cursor";
  terminal(raiz, null, [`specify init --here --integration ${usarCursor ? "cursor-agent" : "claude"} --script ps`]);
  vscode.window.showInformationMessage("Confirme no terminal. Quando terminar, o repositório aparece no painel.");
  return true;
}

/** Pergunta o repositório sempre que houver mais de um; oferece instalar o Spec Kit se faltar. */
async function escolherRaiz() {
  const rs = repos();
  if (!rs.length) return undefined;
  const r =
    rs.length === 1
      ? rs[0]
      : (
          await vscode.window.showQuickPick(
            rs.map((x) => ({
              label: path.basename(x.dir),
              description: x.specKit ? "" : "sem Spec Kit (instalar primeiro)",
              detail: x.dir,
              x,
            })),
            { placeHolder: "Em qual repositório vai a nova feature?" },
          )
        )?.x;
  if (!r) return undefined;
  if (!r.specKit) {
    await instalarSpecKit(r.dir);
    return undefined;
  }
  return r.dir;
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

async function executarPasso(passo, item) {
  const f = await escolherFeature(item);
  if (!f) return;
  let args = "";
  if (passo === "taskstoclickup") {
    const padrao = vscode.workspace.getConfiguration("sdd").get("listaClickUp") || "";
    const lista = await vscode.window.showInputBox({ prompt: "Lista do ClickUp", value: padrao });
    if (lista === undefined) return;
    args = lista;
  } else if (passo !== "analyze") {
    const extra = await vscode.window.showInputBox({
      prompt: `${PASSOS[passo]}: instruções extras (opcional)`,
      placeHolder: passo === "implement" ? "ex.: só a Fase 1" : "Enter para seguir sem instruções",
    });
    if (extra === undefined) return;
    args = extra;
  }
  rodar(f.raiz, f.dir, `/speckit-${passo}${args ? " " + args : ""}`);
}

/** @param {vscode.ExtensionContext} ctx */
function activate(ctx) {
  const arvore = new Arvore();
  let espera;
  const atualizar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => arvore.atualizar(), 300);
  };
  const vigia = vscode.workspace.createFileSystemWatcher("**/{specs/**,.specify/feature.json,.specify/init-options.json}");
  vigia.onDidCreate(atualizar);
  vigia.onDidChange(atualizar);
  vigia.onDidDelete(atualizar);

  ctx.subscriptions.push(
    vigia,
    vscode.window.registerTreeDataProvider("sdd.features", arvore),
    vscode.commands.registerCommand("sdd.atualizar", () => arvore.atualizar()),
    vscode.workspace.onDidChangeWorkspaceFolders(atualizar),
    vscode.commands.registerCommand("sdd.instalarSpecKit", (item) => item?.raiz && instalarSpecKit(item.raiz)),
    vscode.commands.registerCommand("sdd.novaFeature", async (item) => {
      // "+" na linha do repositório já diz onde; o "+" do topo pergunta.
      const raiz = item?.tipo === "repo" && item.specKit ? item.raiz : await escolherRaiz();
      if (!raiz) {
        if (!repos().length) vscode.window.showWarningMessage("Nenhum repositório git na pasta aberta.");
        return;
      }
      const descricao = await vscode.window.showInputBox({
        prompt: "O que você quer construir e por quê? (sem falar de tecnologia)",
        placeHolder: "ex.: O cidadão precisa baixar o comprovante do PIX de entrada depois de pago",
        ignoreFocusOut: true,
      });
      if (!descricao) return;
      const nome = await vscode.window.showInputBox({
        prompt: "Nome curto para a branch (Enter para não criar branch)",
        placeHolder: "ex.: comprovante-pix",
      });
      if (nome === undefined) return;
      const s = lib.slug(nome);
      const antes = s ? [`git switch -c ${lib.proximoNumero(lib.listarFeatures(raiz))}-${s}`] : [];
      rodar(raiz, null, `/speckit-specify ${descricao}`, antes);
    }),
    vscode.commands.registerCommand("sdd.proximo", async (item) => {
      const f = await escolherFeature(item);
      if (!f) return;
      if (!f.etapa.proximo) return vscode.window.showInformationMessage("Esta feature ainda não tem spec.md.");
      executarPasso(f.etapa.proximo, f);
    }),
    ...Object.keys(PASSOS).map((p) => vscode.commands.registerCommand(`sdd.${p}`, (item) => executarPasso(p, item))),
  );
}

module.exports = { activate, deactivate() {} };
