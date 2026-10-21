const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const lib = require("./lib");

test("contarTarefas", () => {
  const t = lib.contarTarefas("- [X] T001 a\n- [x] T002 [P] b\n- [ ] T003 c\n- [ ] sem id\n");
  assert.deepStrictEqual(t, { feitas: 2, total: 3 });
});

test("passoDoArquivo mapeia os arquivos do fluxo", () => {
  assert.strictEqual(lib.passoDoArquivo("spec.md"), 1);
  for (const nome of ["plan.md", "research.md", "data-model.md", "quickstart.md"]) assert.strictEqual(lib.passoDoArquivo(nome), 3);
  assert.strictEqual(lib.passoDoArquivo("tasks.md"), 4);
  assert.strictEqual(lib.passoDoArquivo("notes.md"), null);
});

test("featuresOutrasBranches encontra feature em branch local e respeita pasta local", (t) => {
  try {
    execFileSync("git", ["--version"], { encoding: "utf8", windowsHide: true });
  } catch {
    t.skip("git indisponível");
    return;
  }
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8", windowsHide: true });
  git("init");
  git("config", "user.email", "teste@example.com");
  git("config", "user.name", "Teste");
  git("commit", "--allow-empty", "-m", "inicial");
  git("switch", "-c", "002-outra");
  fs.mkdirSync(path.join(raiz, "specs", "002-outra"), { recursive: true });
  fs.writeFileSync(path.join(raiz, "specs", "002-outra", "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(raiz, "specs", "002-outra", "plan.md"), "# Plan\n");
  git("add", ".");
  git("commit", "-m", "feature");
  git("switch", "-");

  assert.deepStrictEqual(lib.featuresOutrasBranches(raiz), [
    { nome: "002-outra", ref: "002-outra", remota: false, etapa: { id: "plano", rotulo: "plano pronto", proximo: "tasks" } },
  ]);
  fs.mkdirSync(path.join(raiz, "specs", "002-outra"), { recursive: true });
  assert.deepStrictEqual(lib.featuresOutrasBranches(raiz), []);
});

test("etapa segue spec → plan → tasks → implement → converge", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  assert.strictEqual(lib.etapa(dir).proximo, null);
  fs.writeFileSync(path.join(dir, "spec.md"), "");
  assert.strictEqual(lib.etapa(dir).proximo, "plan");
  fs.writeFileSync(path.join(dir, "plan.md"), "");
  assert.strictEqual(lib.etapa(dir).proximo, "tasks");
  fs.writeFileSync(path.join(dir, "tasks.md"), "- [X] T001 a\n- [ ] T002 b\n");
  assert.deepStrictEqual(lib.etapa(dir), { id: "implementando", rotulo: "tarefas 1/2", proximo: "implement" });
  fs.writeFileSync(path.join(dir, "tasks.md"), "- [X] T001 a\n- [X] T002 b\n");
  assert.strictEqual(lib.etapa(dir).proximo, "converge");
});

test("listarFeatures, proximoNumero e featureAtual", () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  assert.deepStrictEqual(lib.listarFeatures(raiz), []);
  for (const d of ["002-b", "001-a", "rascunho"]) fs.mkdirSync(path.join(raiz, "specs", d), { recursive: true });
  assert.deepStrictEqual(lib.listarFeatures(raiz), ["001-a", "002-b"]);
  assert.strictEqual(lib.proximoNumero(["001-a", "002-b"]), "003");
  assert.strictEqual(lib.proximoNumero([]), "001");
  fs.mkdirSync(path.join(raiz, ".specify"));
  fs.writeFileSync(path.join(raiz, ".specify", "feature.json"), '{"feature_directory":"specs/002-b"}');
  assert.strictEqual(lib.featureAtual(raiz), path.join(raiz, "specs", "002-b"));
});

test("repositorios acha a raiz ou as subpastas diretas e diz se tem Spec Kit", () => {
  const mae = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  const front = path.join(mae, "front");
  const back = path.join(mae, "back");
  fs.mkdirSync(path.join(front, ".specify"), { recursive: true });
  fs.writeFileSync(path.join(front, ".specify", "init-options.json"), "{}");
  fs.mkdirSync(path.join(back, ".git"), { recursive: true });
  fs.mkdirSync(path.join(mae, "docs")); // não é repositório
  assert.deepStrictEqual(lib.repositorios(mae), [
    { dir: back, specKit: false },
    { dir: front, specKit: true },
  ]);
  assert.deepStrictEqual(lib.repositorios(front), [{ dir: front, specKit: true }]);
});

test("slug", () => {
  assert.strictEqual(lib.slug("  Comprovante PIX de Entrada! "), "comprovante-pix-de-entrada");
});

test("comandoAgente escapa aspas por shell", () => {
  const p = "/speckit-specify O cidadão d'água “x” ‘y’";
  assert.strictEqual(
    lib.comandoAgente("claude", p, "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"),
    "claude '/speckit-specify O cidadão d''água “x” ‘‘y’’'",
  );
  assert.strictEqual(lib.comandoAgente("claude", "a'b", "/bin/bash"), "claude 'a'\\''b'");
  assert.strictEqual(lib.comandoAgente("claude", 'a"b', "C:\\Windows\\System32\\cmd.exe"), "claude \"a'b\"");
  assert.strictEqual(lib.juntar(["x", "y"], "C:\\Windows\\System32\\cmd.exe"), "x & y");
  assert.strictEqual(lib.juntar(["x", "y"], "pwsh"), "x; y");
});

test("invocacao e integracoes por IA", () => {
  assert.strictEqual(lib.invocacao("claude", "specify", "x"), "/speckit-specify x");
  assert.strictEqual(lib.invocacao("codex", "plan"), "$speckit-plan");
  assert.strictEqual(lib.invocacao("opencode", "tasks"), "/speckit.tasks");
  assert.strictEqual(lib.invocacao("desconhecida", "plan"), "/speckit-plan");
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  assert.deepStrictEqual(lib.integracoes(raiz), []);
  fs.mkdirSync(path.join(raiz, ".specify"));
  fs.writeFileSync(path.join(raiz, ".specify", "integration.json"), JSON.stringify({ installed_integrations: ["claude", "cursor-agent"] }));
  assert.deepStrictEqual(lib.integracoes(raiz), ["claude", "cursor-agent"]);
});

test("orquestracao e skills", () => {
  assert.deepStrictEqual(lib.PASSOS_ORQ, ["plan", "tasks", "analyze", "implement", "converge"]);
  assert.strictEqual(
    lib.promptOrquestrado("orq", "/speckit-implement so fase 1"),
    "/orq Execute /speckit-implement so fase 1 seguindo o Spec Kit (chame a skill pela ferramenta Skill). No fim, mostre a tabela de tokens por IA.",
  );
  const prompt = "x";
  assert.strictEqual(lib.promptOrquestrado("desligada", prompt), prompt);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-orq-"));
  assert.strictEqual(lib.skillInstalada("orq", home), false);
  fs.mkdirSync(path.join(home, ".claude", "skills", "orq"), { recursive: true });
  fs.writeFileSync(path.join(home, ".claude", "skills", "orq", "SKILL.md"), "# orq\n");
  assert.strictEqual(lib.skillInstalada("orq", home), true);
  assert.strictEqual(lib.aplicaOrquestracao("claude", "plan", "orq"), true);
  assert.strictEqual(lib.aplicaOrquestracao("claude", "clarify", "orq"), false);
  assert.strictEqual(lib.aplicaOrquestracao("cursor", "plan", "orq"), false);
  assert.strictEqual(lib.aplicaOrquestracao("claude", "plan", "desligada"), false);
});

test("ClickUp: valida, grava e relê o vínculo", () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-clickup-"));
  assert.strictEqual(lib.workspaceDaUrl("https://app.clickup.com/90132384077/v/l/f/1000270000010285"), "90132384077");
  assert.strictEqual(lib.workspaceDaUrl("http://app.clickup.com/90132384077/v/l/f/1"), null);
  assert.strictEqual(lib.workspaceDaUrl("https://example.com/90132384077/v/l/f/1"), null);
  assert.strictEqual(lib.workspaceDaUrl("https://app.clickup.com/abc/v/l/f/1"), null);
  assert.strictEqual(lib.lerClickUp(raiz), null);
  assert.throws(() => lib.salvarClickUp(raiz, "http://app.clickup.com/90132384077/v/l/f/1"), /Link do ClickUp invalido/);
  const url = "https://app.clickup.com/90132384077/v/l/f/1000270000010285";
  assert.deepStrictEqual(lib.salvarClickUp(raiz, url), { workspace_id: "90132384077", url });
  assert.deepStrictEqual(lib.lerClickUp(raiz), { workspace_id: "90132384077", url });
  assert.strictEqual(fs.readFileSync(path.join(raiz, ".specify", "clickup.json"), "utf8"), JSON.stringify({ workspace_id: "90132384077", url }, null, 2) + "\n");
});

test("trilha: specify atual; com spec+plan → tasks atual; Clarifications → clarify feito", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  let t = lib.trilha(dir);
  assert.strictEqual(t[0].passo, "specify");
  assert.strictEqual(t[0].estado, "atual");
  assert.strictEqual(t[1].estado, "opcional");

  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(dir, "plan.md"), "");
  t = lib.trilha(dir);
  assert.strictEqual(t.find((p) => p.passo === "specify").estado, "feito");
  assert.strictEqual(t.find((p) => p.passo === "clarify").estado, "opcional");
  assert.strictEqual(t.find((p) => p.passo === "plan").estado, "feito");
  assert.strictEqual(t.find((p) => p.passo === "tasks").estado, "atual");

  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n## Clarifications\n");
  t = lib.trilha(dir);
  assert.strictEqual(t.find((p) => p.passo === "clarify").estado, "feito");
});

test("branchAtual lê refs/heads ou devolve null", () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-"));
  assert.strictEqual(lib.branchAtual(raiz), null);
  fs.mkdirSync(path.join(raiz, ".git"));
  fs.writeFileSync(path.join(raiz, ".git", "HEAD"), "ref: refs/heads/001-foo\n");
  assert.strictEqual(lib.branchAtual(raiz), "001-foo");
  fs.writeFileSync(path.join(raiz, ".git", "HEAD"), "abc123def\n");
  assert.strictEqual(lib.branchAtual(raiz), null);
});

test("comMarcador e temMarcador", () => {
  const p = lib.comMarcador("/speckit-plan");
  assert.strictEqual(
    p,
    "/speckit-plan Ao terminar, escreva a palavra pronto em maiúsculas, sozinha, na última linha.",
  );
  assert.strictEqual(lib.temMarcador(p), false);
  assert.strictEqual(lib.temMarcador(lib.promptOrquestrado("orq", p)), false);
  assert.strictEqual(lib.temMarcador("pronto\nPronto\nAPRONTOU\nPRONTOS"), false);
  assert.strictEqual(lib.temMarcador("Tudo certo.\nPRONTO\n"), true);
  assert.strictEqual(lib.temMarcador("\x1b]633;C\x07\x1b[1;32mPRONTO\x1b[0m\r\n"), true);
});
