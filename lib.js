// @ts-check
// Lógica pura (sem a API do VS Code), testada em test.js com `node --test`.
const fs = require("fs");
const path = require("path");

/** Conta tarefas `- [ ] T001` / `- [X] T001` do tasks.md. */
function contarTarefas(texto) {
  const feitas = (texto.match(/^\s*- \[[xX]\] T\d{3,}/gm) || []).length;
  const abertas = (texto.match(/^\s*- \[ \] T\d{3,}/gm) || []).length;
  return { feitas, total: feitas + abertas };
}

/** Em que etapa a feature está e qual é o próximo comando. */
function etapa(dir) {
  const tem = (f) => fs.existsSync(path.join(dir, f));
  if (!tem("spec.md")) return { id: "vazia", rotulo: "sem spec", proximo: null };
  if (!tem("plan.md")) return { id: "spec", rotulo: "spec pronta", proximo: "plan" };
  if (!tem("tasks.md")) return { id: "plano", rotulo: "plano pronto", proximo: "tasks" };
  const t = contarTarefas(fs.readFileSync(path.join(dir, "tasks.md"), "utf8"));
  if (t.total === 0 || t.feitas < t.total) {
    return { id: "implementando", rotulo: `tarefas ${t.feitas}/${t.total}`, proximo: "implement" };
  }
  return { id: "concluida", rotulo: `concluída ${t.feitas}/${t.total}`, proximo: "converge" };
}

/** Pastas de feature em specs/ (001-nome, 20261021-nome...). */
function listarFeatures(raiz) {
  const specs = path.join(raiz, "specs");
  if (!fs.existsSync(specs)) return [];
  return fs
    .readdirSync(specs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

/** Feature marcada em .specify/feature.json, como caminho absoluto. */
function featureAtual(raiz) {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(raiz, ".specify", "feature.json"), "utf8"));
    return json.feature_directory ? path.resolve(raiz, json.feature_directory) : null;
  } catch {
    return null;
  }
}

/** Nome da branch em `.git/HEAD` (ref: refs/heads/X), ou null. */
function branchAtual(raiz) {
  try {
    const head = fs.readFileSync(path.join(raiz, ".git", "HEAD"), "utf8").trim();
    const m = /^ref: refs\/heads\/(.+)$/.exec(head);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Checklist do fluxo Spec Kit na pasta da feature.
 * estado ∈ feito | atual | pendente | opcional.
 */
function trilha(dir) {
  const tem = (f) => fs.existsSync(path.join(dir, f));
  const temSpec = tem("spec.md");
  let clarifications = false;
  if (temSpec) {
    clarifications = fs.readFileSync(path.join(dir, "spec.md"), "utf8").includes("## Clarifications");
  }
  const t = tem("tasks.md")
    ? contarTarefas(fs.readFileSync(path.join(dir, "tasks.md"), "utf8"))
    : { feitas: 0, total: 0 };
  const implementFeito = t.total > 0 && t.feitas === t.total;

  const passos = [
    { passo: "specify", titulo: "1. Especificar", explicacao: "O quê e por quê, sem tecnologia → spec.md", estado: temSpec ? "feito" : "pendente" },
    { passo: "clarify", titulo: "2. Esclarecer (opcional)", explicacao: "A IA pergunta o que ficou ambíguo e anota na spec", estado: clarifications ? "feito" : "opcional" },
    { passo: "plan", titulo: "3. Planejar", explicacao: "Como fazer: tecnologia, arquivos, dados → plan.md", estado: tem("plan.md") ? "feito" : "pendente" },
    { passo: "tasks", titulo: "4. Quebrar em tarefas", explicacao: "Lista de tarefas T001, T002… → tasks.md", estado: tem("tasks.md") ? "feito" : "pendente" },
    { passo: "analyze", titulo: "5. Conferir (opcional)", explicacao: "Checa se spec, plano e tarefas batem entre si", estado: "opcional" },
    { passo: "implement", titulo: "6. Implementar", explicacao: `Executa as tarefas: ${t.feitas}/${t.total} feitas`, estado: implementFeito ? "feito" : "pendente" },
    { passo: "converge", titulo: "7. Fechar (converge + PR)", explicacao: "Confere o que falta, abre o PR e liga ao ClickUp", estado: implementFeito ? "atual" : "pendente" },
  ];

  if (!implementFeito) {
    const i = passos.findIndex((p) => p.estado !== "feito" && p.estado !== "opcional");
    if (i >= 0) passos[i].estado = "atual";
  }
  return passos;
}

const temSpecKit = (p) => fs.existsSync(path.join(p, ".specify", "init-options.json"));
const ehRepo = (p) => fs.existsSync(path.join(p, ".git")) || fs.existsSync(path.join(p, ".specify"));

/**
 * Repositórios da pasta aberta: ela mesma, se for um repo, ou as subpastas diretas que forem
 * (ex.: abriu renegocia-dmt/ com frontend e backend dentro). `specKit` diz se já está instalado.
 */
function repositorios(pasta) {
  const info = (dir) => ({ dir, specKit: temSpecKit(dir) });
  if (ehRepo(pasta)) return [info(pasta)];
  try {
    return fs
      .readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
      .map((d) => path.join(pasta, d.name))
      .filter(ehRepo)
      .map(info);
  } catch {
    return [];
  }
}

function proximoNumero(features) {
  const maior = Math.max(0, ...features.map((f) => parseInt(f, 10)).filter((n) => n < 100000));
  return String(maior + 1).padStart(3, "0");
}

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/**
 * IAs suportadas: `exe` abre a sessão interativa já com o prompt, `integracao` é a chave do
 * `specify integration`, `prefixo` é como cada uma chama os comandos do Spec Kit.
 */
const AGENTES = {
  claude: { nome: "Claude Code", exe: "claude", integracao: "claude", prefixo: "/speckit-" },
  cursor: { nome: "Cursor", exe: "agent", integracao: "cursor-agent", prefixo: "/speckit-" },
  codex: { nome: "Codex (GPT)", exe: "codex", integracao: "codex", prefixo: "$speckit-" },
  opencode: { nome: "OpenCode", exe: "opencode --prompt", integracao: "opencode", prefixo: "/speckit." },
  agy: { nome: "Antigravity", exe: "agy -i", integracao: "agy", prefixo: "/speckit-" },
};

const agente = (id) => AGENTES[id] || AGENTES.claude;

/** Ex.: invocacao("codex", "plan", "só a fase 1") → "$speckit-plan só a fase 1". */
function invocacao(id, passo, args) {
  return agente(id).prefixo + passo + (args ? " " + args : "");
}

/** Integrações do Spec Kit já instaladas no repositório (.specify/integration.json). */
function integracoes(raiz) {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(raiz, ".specify", "integration.json"), "utf8"));
    return json.installed_integrations || (json.integration ? [json.integration] : []);
  } catch {
    return [];
  }
}

const ehCmd = (shell) => /cmd\.exe$/i.test(shell || "");
const ehPowerShell = (shell) => /pwsh|powershell/i.test(shell || "");

/** `claude '<prompt>'` com as aspas certas para o shell do terminal. */
function comandoAgente(exe, prompt, shell) {
  if (ehCmd(shell)) return `${exe} "${prompt.replace(/"/g, "'")}"`;
  // PowerShell também trata aspas curvas como aspas simples: dobra todas.
  if (ehPowerShell(shell)) return `${exe} '${prompt.replace(/['‘’‚‛]/g, "$&$&")}'`;
  return `${exe} '${prompt.replace(/'/g, "'\\''")}'`;
}

function juntar(comandos, shell) {
  return comandos.join(ehCmd(shell) ? " & " : "; ");
}

module.exports = {
  contarTarefas, etapa, listarFeatures, featureAtual, branchAtual, trilha, repositorios, proximoNumero, slug,
  comandoAgente, juntar, AGENTES, agente, invocacao, integracoes,
};
