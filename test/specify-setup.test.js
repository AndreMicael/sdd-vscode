"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSpecifySetup } = require("../specify-setup");

const installation = { executable: "/tools/specify", binDirectory: "/tools", compatible: true, origin: "external", version: "1.2.2" };
function fixture(options = {}) {
  let saved = options.saved || null, candidate = options.candidate, installs = 0, probes = 0, locked = false;
  const states = [];
  const store = {
    read: async () => saved,
    write: async value => { if (options.writeError) throw new Error("disk full"); saved = { ...saved, ...value }; },
    acquire: async () => { if (locked) return null; locked = true; return { token: "test" }; },
    release: async () => { locked = false; }, updateLock: async () => {}, recover: async () => false, readLock: async () => null,
  };
  const platform = {
    environment: { supported: options.supported !== false }, identity: async () => "identity", liveness: async () => "alive",
    discover: async () => { probes++; return candidate; },
    verifyTerminal: async () => options.terminal !== false,
    commandEnvironment: () => ({ PATH: "/tools" }),
    install: async ({ stage, signal }) => {
      assert.equal(saved.automaticAttemptConsumed, true);
      assert.equal(locked, true); installs++;
      stage("python"); stage("specify");
      if (options.install) await options.install(signal);
      if (options.failure) throw Object.assign(new Error(options.failure), { code: "NETWORK" });
      candidate = { ...installation, origin: "managed" }; return candidate;
    },
  };
  const service = createSpecifySetup({ platform, store, report: s => states.push(s.state) });
  return { service, states, platform, store, get saved() { return saved; }, get installs() { return installs; }, get probes() { return probes; }, set candidate(value) { candidate = value; } };
}

test("first activation persists before effects, deduplicates and requires terminal", async () => {
  const f = fixture();
  const a = f.service.check({ reason: "activation" });
  assert.equal(a, f.service.check({ reason: "activation" }));
  assert.equal((await a).state, "ready");
  assert.equal(f.installs, 1);
  assert.ok(f.states.includes("installing"));
  assert.equal((await f.service.ensureReady()).ready, true);
  assert.equal(f.installs, 1);
  const pendingTerminal = fixture({ terminal: false });
  assert.equal((await pendingTerminal.service.check({ reason: "activation" })).state, "verification-required");
});

test("remote, incompatible and compatible copies never download", async () => {
  for (const options of [{ supported: false }, { candidate: installation }, { candidate: { ...installation, compatible: false } }]) {
    const f = fixture(options); await f.service.check({ reason: "activation" }); assert.equal(f.installs, 0);
  }
});

test("failed/cancelled/removed/reloaded states cannot reinstall automatically", async () => {
  for (const state of ["failed", "cancelled", "installing", "ready"]) {
    const f = fixture({ saved: { state, automaticAttemptConsumed: true, installation: state === "ready" ? installation : undefined } });
    await f.service.check({ reason: "activation" }); assert.equal(f.installs, 0);
    assert.equal((await f.service.ensureReady()).ready, false);
    assert.equal((await f.service.retry()).state, "ready"); assert.equal(f.installs, 1);
  }
});

test("manual repair is recognized; removal is detected; explicit repair preserves external", async () => {
  const f = fixture({ candidate: installation });
  await f.service.check({ reason: "activation" }); const probes = f.probes;
  assert.equal((await f.service.ensureReady()).ready, true); assert.ok(f.probes > probes);
  f.candidate = null; assert.equal((await f.service.ensureReady()).ready, false);
  f.candidate = installation; assert.equal((await f.service.check()).state, "ready");
  assert.equal(f.installs, 0);
  assert.equal((await f.service.repair()).installation.origin, "managed");
});

test("persistence errors block installers and diagnostics remove secrets", async () => {
  const f = fixture({ writeError: true }); assert.equal((await f.service.retry()).state, "failed"); assert.equal(f.installs, 0);
  const g = fixture({ failure: "https://user:secret@host/?token=credential" });
  const result = await g.service.retry(); assert.equal(result.state, "failed"); assert.doesNotMatch(result.error.message, /secret|credential/);
});

test("cancelling pending install waits and does not announce success", async () => {
  let entered;
  const ready = new Promise(r => { entered = r; });
  const f = fixture({ install: signal => new Promise(resolve => { entered(); signal.addEventListener("abort", resolve, { once: true }); }) });
  const work = f.service.retry(); await ready;
  assert.equal((await f.service.ensureReady()).ready, false);
  await f.service.cancel(); assert.equal((await work).state, "cancelled");
  assert.equal(f.states.includes("ready"), false);
});

test("observer cancellation never cancels the owner and manual retry rechecks reality", async () => {
  const f = fixture(); let active = true;
  f.store.readLock = async () => active ? { ownerPid: 1, ownerStartedAt: "owner" } : null;
  const work = f.service.check({ reason: "activation" });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.service.snapshot.state, "waiting");
  await f.service.cancel(); assert.equal((await work).state, "cancelled");
  assert.equal(f.installs, 0); active = false; f.candidate = installation;
  assert.equal((await f.service.retry()).state, "ready"); assert.equal(f.installs, 0);
});

test("errors remain actionable and reload does not resume installation", async () => {
  for (const failure of ["network unavailable", "permission denied", "disk full", "Python distribution unavailable", "package not found"]) {
    const f = fixture({ failure }); const result = await f.service.check({ reason: "activation" });
    assert.equal(result.state, "failed"); assert.equal(result.error.message, failure);
    assert.ok(result.recoveryActions.includes("retry"));
    const reload = fixture({ saved: f.saved }); await reload.service.check({ reason: "activation" }); assert.equal(reload.installs, 0);
  }
});

test("bootstrap success, failure and cancellation preserve a workspace fixture byte for byte", async t => {
  const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-preserve-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = ["spec.md", "plan.md", "tasks.md", "integration.json"];
  for (const file of files) await fs.writeFile(path.join(root, file), `original ${file}\n`);
  const hash = async () => Promise.all((await fs.readdir(root)).sort().map(async file => [file, crypto.createHash("sha256").update(await fs.readFile(path.join(root, file))).digest("hex")]));
  const before = await hash();
  for (const options of [{}, { failure: "network" }, { install: async () => { throw Object.assign(new Error("cancelled"), { code: "CANCELLED" }); } }]) {
    const f = fixture(options); await f.service.check({ reason: "activation" }); assert.deepEqual(await hash(), before);
  }
});
