const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./lib");

test("contarTarefas", () => {
  const t = lib.contarTarefas("- [X] T001 a\n- [x] T002 [P] b\n- [ ] T003 c\n- [ ] sem id\n");
  assert.deepStrictEqual(t, { feitas: 2, total: 3 });
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
