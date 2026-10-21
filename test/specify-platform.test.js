"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const platform = require("../specify-platform");

test("environment shared across editors; remote and browser excluded", () => {
  const base = { platform: "linux", arch: "x64", home: "/home/user", env: {}, hostname: "host" };
  const a = platform.environment({ ...base, editor: "Code" });
  const b = platform.environment({ ...base, editor: "Cursor" });
  assert.equal(a.root, b.root);
  assert.equal(a.key, b.key);
  assert.equal(a.root, "/home/user/.local/share/sdd-speckit");
  assert.equal(platform.environment({ ...base, remoteName: "ssh" }).supported, false);
  assert.equal(platform.environment({ ...base, uiKind: 2 }).supported, false);
  assert.equal(platform.environment({ ...base, workspaceRoots: ["/home/user"] }).supported, false);
  assert.equal(platform.environment({ ...base, platform: "darwin" }).root, "/home/user/Library/Application Support/sdd-speckit");
  assert.equal(platform.environment({ ...base, platform: "win32", home: "C:\\Users\\user", env: { LOCALAPPDATA: "C:\\data" } }).root, "C:\\data\\sdd-speckit");
});

test("async runner preserves Unicode arguments and removes credentials", async () => {
  const r = await platform.run(process.execPath, ["-e", "console.log(process.argv[1])", "ação com espaços"], { cwd: os.tmpdir() });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "ação com espaços");
  assert.doesNotMatch(platform.sanitize("https://user:secret@host/path?token=abc PASSWORD=secret"), /secret|abc/);
});

test("runner timeout and cancellation wait for process termination", async () => {
  await assert.rejects(platform.run(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: os.tmpdir(), timeout: 100 }), /timed out/);
  const controller = new AbortController();
  const pending = platform.run(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: os.tmpdir(), signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(pending, /cancelled/);
});

test("PATH prefix is idempotent, respects Windows casing and quotes shells", () => {
  const first = platform.prependPath({ Path: "C:\\old" }, "C:\\ação tools", "win32");
  assert.equal(platform.prependPath(first, "C:\\ação tools", "win32").Path, first.Path);
  assert.equal(platform.quote("a'b", "bash"), "'a'\\''b'");
  assert.equal(platform.quote("a'b", "powershell"), "'a''b'");
});

test("probe checks capabilities, uses neutral cwd, never initializes a project", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-probe-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls = [];
  const adapter = platform.createPlatform({ root, execute: async (exe, args, options) => {
    calls.push(args); assert.equal(options.cwd, root);
    return { code: 0, stdout: args[0] === "version" ? "1.2.2" : "--here --integration --script --force", stderr: "" };
  } });
  const result = await adapter.probe(path.join(root, "specify"));
  assert.equal(result.compatible, true);
  assert.deepEqual(calls, [["version"], ["init", "--help"], ["integration", "install", "--help"]]);
});

test("managed uv env ignores inherited indexes and configuration", () => {
  const value = platform.managedEnvironment("/data/sdd", { PATH: "/bin", UV_INDEX_URL: "https://evil", PIP_INDEX_URL: "https://evil", UV_INSECURE_HOST: "*" });
  assert.equal(value.UV_INDEX_URL, undefined);
  assert.equal(value.UV_INSECURE_HOST, undefined);
  assert.equal(value.UV_NO_CONFIG, "1");
  assert.equal(value.UV_TOOL_DIR, path.join("/data/sdd", "tools"));
});

test("download rejects insecure redirect before writing bytes", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-download-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(platform.download("http://astral.sh/uv/install.sh", path.join(root, "installer")), /HTTPS/);
  assert.deepEqual(await fs.readdir(root), []);
});

test("HTTPS redirects preserve TLS and enforce host/redirect limits", async t => {
  const { EventEmitter } = require("node:events");
  const { Readable } = require("node:stream");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-https-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let calls = 0, insecure = false;
  const request = (url, options, callback) => {
    assert.equal(options.rejectUnauthorized, true); assert.equal(url.protocol, "https:"); calls++;
    const req = new EventEmitter(); req.destroy = e => req.emit("error", e);
    process.nextTick(() => {
      const res = Readable.from([Buffer.from("installer")]);
      res.statusCode = calls === 1 ? 302 : 200;
      res.headers = { location: insecure ? "http://astral.sh/install" : "https://releases.astral.sh/installers/uv/latest/uv-installer.ps1" };
      callback(res);
    });
    return req;
  };
  const file = path.join(root, "installer");
  await platform.download("https://astral.sh/uv/install.sh", file, { request });
  assert.equal(await fs.readFile(file, "utf8"), "installer"); assert.equal(calls, 2);
  calls = 0; insecure = true;
  await assert.rejects(platform.download("https://astral.sh/uv/install.sh", path.join(root, "bad"), { request }), /HTTPS/);
  calls = 0;
  await assert.rejects(platform.download("https://astral.sh/uv/install.sh", path.join(root, "limit"), { request, redirects: 0 }), /limit/);
});

test("isolated installer uses only official package and managed Python, never project operations", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-install-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls = [], stages = [];
  const adapter = platform.createPlatform({ root, env: {}, execute: async (executable, args, opts) => {
    calls.push({ executable, args }); assert.equal(opts.cwd, root); assert.equal(opts.env.UV_TOOL_DIR, path.join(root, "tools"));
    return { code: 0, stdout: args[0] === "python" && args[1] === "find" ? process.execPath : "version", stderr: "" };
  }, download: async (url, file) => { assert.match(url, /^https:\/\/astral.sh\/uv\/install\.(ps1|sh)$/); await fs.writeFile(file, "fixture"); } });
  await adapter.install({ signal: new AbortController().signal, attemptId: "test", processHooks: {}, stage: s => stages.push(s) });
  assert.deepEqual(stages, ["uv", "python", "specify"]);
  assert.ok(calls.some(c => c.args.includes("specify-cli==1.2.2")));
  assert.equal(calls.some(c => c.args.includes("init") || c.args.includes("integration")), false);
  assert.equal((await fs.readdir(root)).some(f => f.startsWith("installer-")), false);
});

test("tracked installer cancellation terminates descendants before releasing tracking", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-tree-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const script = path.join(root, "parent.js"), pidFile = path.join(root, "child.pid");
  await fs.writeFile(script, `const {spawn}=require('child_process'); const fs=require('fs'); const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); fs.writeFileSync(process.argv[2],String(p.pid)); setInterval(()=>{},1000);`);
  const controller = new AbortController();
  let confirmed = false;
  const pending = platform.run(process.execPath, [script, pidFile], { cwd: root, signal: controller.signal,
    beforeSpawn: async () => {}, onSpawn: async () => {}, onExit: async exited => { confirmed = exited; } });
  const assertion = assert.rejects(pending, /cancelled/);
  const deadline = Date.now() + 20000;
  let pid;
  while (!pid && Date.now() < deadline) {
    try { pid = Number(await fs.readFile(pidFile, "utf8")); } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  controller.abort(); await assertion;
  assert.ok(pid, "fixture spawned a descendant");
  assert.equal(confirmed, true);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});

test("terminal proof rejects a different resolved executable and verifies the selected copy", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-shell-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const executable = path.join(root, "specify.exe"); await fs.writeFile(executable, "fixture");
  let wrong = true;
  const adapter = platform.createPlatform({ root, shell: process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : "/bin/bash", execute: async () => ({ code: 0, stdout: `proof|0|${wrong ? process.execPath : executable}\n` }) });
  const candidate = { executable, binDirectory: root };
  assert.equal(await adapter.verifyTerminal(candidate, { attemptId: "proof" }), false);
  wrong = false; assert.equal(await adapter.verifyTerminal(candidate, { attemptId: "proof" }), true);
  assert.deepEqual(await fs.readdir(root), ["specify.exe"]);
});

test("Windows cmd and PowerShell execute terminal proof with spaces and Unicode", { skip: process.platform !== "win32" }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd ação "));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const executable = path.join(root, "specify.exe");
  await fs.copyFile(process.execPath, executable);
  // Node renamed as a deterministic CLI fixture; no Specify installation/download.
  await fs.writeFile(path.join(root, "version"), "console.log('fixture 1.2.2');");
  for (const [shell, args] of [[path.join(process.env.SystemRoot, "System32", "cmd.exe"), []],
    [path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-ExecutionPolicy", "Bypass"]]]) {
    const diagnostics = [];
    const adapter = platform.createPlatform({ root, terminalProfile: () => ({ shell, args }), log: s => diagnostics.push(s),
      execute: async (...parameters) => { const result = await platform.run(...parameters); diagnostics.push(result); return result; } });
    assert.equal(await adapter.verifyTerminal({ executable, binDirectory: root }, { attemptId: "windows-proof" }), true, JSON.stringify({ shell, diagnostics }));
  }
});

test("integrated terminal fallback requires a matching proof file, not sendText", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-proof-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const executable = path.join(root, "specify"); await fs.writeFile(executable, "fixture");
  for (const valid of [false, true]) {
    let disposed = false, sent = false;
    const adapter = platform.createPlatform({ root, shell: "/bin/bash", execute: async () => ({ code: 1, stdout: "", stderr: "profile changed PATH" }),
      openVerificationTerminal: () => {
        sent = true;
        void fs.writeFile(path.join(root, "terminal-proof.result"), `proof|0|${valid ? executable : process.execPath}\n`);
        return { dispose: () => { disposed = true; } };
      } });
    assert.equal(await adapter.verifyTerminal({ executable, binDirectory: root }, { attemptId: "proof", allowFallback: true }), valid);
    assert.ok(sent); assert.ok(disposed);
    assert.deepEqual(await fs.readdir(root), ["specify"]);
  }
});
