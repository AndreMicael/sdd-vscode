"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createStore } = require("../specify-store");

async function fixture(t, live = async () => "dead") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdd-store-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, store: createStore({ root, identity: async () => "test-start", liveness: live }) };
}

test("atomic state preserves consumed attempt; corrupt/unknown data fails closed", async t => {
  const { root, store } = await fixture(t);
  assert.equal(await store.read(), null);
  await store.write({ automaticAttemptConsumed: true, state: "installing" });
  assert.equal((await store.read()).automaticAttemptConsumed, true);
  assert.deepEqual((await fs.readdir(root)), ["state.json"]);
  await fs.writeFile(path.join(root, "state.json"), "{broken");
  await assert.rejects(store.read(), /state/i);
  await assert.rejects(store.write({}), /state/i);
  await fs.writeFile(path.join(root, "state.json"), '{"schemaVersion":99}');
  await assert.rejects(store.write({}), /schema/i);
});

test("exclusive lock, owner token, live children and ambiguity", async t => {
  let live = "unknown";
  const { store } = await fixture(t, async () => live);
  const lock = await store.acquire("a");
  assert.ok(lock);
  assert.equal(await store.acquire("b"), null);
  await assert.rejects(store.release({ ...lock, token: "wrong" }), /token/i);
  await store.updateLock(lock, [{ pid: 123, startedAt: "start" }]);
  await assert.rejects(store.release(lock), /children/i);
  assert.equal(await store.recover(), false);
  live = "dead";
  assert.equal(await store.recover(), true);
  assert.ok(await store.acquire("c"));
});

test("real processes cannot own the same lock simultaneously", async t => {
  const { root } = await fixture(t);
  const modulePath = require.resolve("../specify-store");
  const script = `const {createStore}=require(process.argv[1]); const s=createStore({root:process.argv[2],identity:async()=>"test",liveness:async()=>"alive"}); (async()=>{const l=await s.acquire("race"); process.stdout.write(l?"won":"busy"); if(l) await new Promise(r=>setTimeout(r,600));})().catch(e=>{console.error(e);process.exitCode=1});`;
  const results = await Promise.all(Array.from({ length: 5 }, () => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["-e", script, modulePath, root], { windowsHide: true });
    let out = ""; p.stdout.on("data", b => { out += b; }); p.on("error", reject);
    p.on("close", code => code ? reject(new Error(`child ${code}`)) : resolve(out));
  })));
  assert.equal(results.filter(x => x === "won").length, 1);
});

test("recovery refuses live children, reused identity and orphan recovery guard", async t => {
  let childrenAlive = true;
  const { root, store } = await fixture(t, async item => item.pid === 555 && childrenAlive ? "alive" : "dead");
  const lock = await store.acquire("orphan");
  await store.updateLock(lock, [{ pid: 555, startedAt: "child" }]);
  assert.equal(await store.recover(), false);
  childrenAlive = false;
  await fs.writeFile(path.join(root, "recovery.lock"), JSON.stringify({ schemaVersion: 1, token: "orphan" }));
  assert.equal(await store.recover(), false);
  assert.equal(await store.acquire("other"), null);
  assert.equal((await store.readLock()).token, lock.token);
});

test("two recoverers serialize and consume automatic eligibility", async t => {
  const { store } = await fixture(t);
  await store.acquire("stale");
  const results = await Promise.all([store.recover(), store.recover()]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await store.readLock(), null);
  assert.equal((await store.read()).state, "interrupted");
  assert.equal((await store.read()).automaticAttemptConsumed, true);
});

test("recovery revalidates token before unlinking a changed owner", async t => {
  let root, changed = false;
  const f = await fixture(t, async () => {
    if (!changed) {
      changed = true;
      const file = path.join(root, "install.lock");
      const current = JSON.parse(await fs.readFile(file, "utf8"));
      await fs.writeFile(file, JSON.stringify({ ...current, token: "replacement" }));
    }
    return "dead";
  });
  root = f.root;
  await f.store.acquire("old");
  assert.equal(await f.store.recover(), false);
  assert.equal((await f.store.readLock()).token, "replacement");
});

test("multiple service processes install once and verify each terminal", async t => {
  const { root } = await fixture(t);
  const script = `
    const fs=require('fs/promises'),path=require('path');
    const {createStore}=require(process.argv[1]); const {createSpecifySetup}=require(process.argv[2]);
    const root=process.argv[3], marker=path.join(root,'installed');
    const identity=async()=>String(process.pid),liveness=async()=> 'alive';
    const candidate={executable:path.join(root,'specify'),binDirectory:root,compatible:true,origin:'managed'};
    const platform={environment:{supported:true},identity,liveness,
      discover:async()=>{try{await fs.access(marker);return candidate}catch{return null}},
      install:async()=>{await fs.appendFile(path.join(root,'installers'),'install\\n');await new Promise(r=>setTimeout(r,400));await fs.writeFile(marker,'ok');return candidate},
      verifyTerminal:async()=>{await fs.appendFile(path.join(root,'terminals'),process.pid+'\\n');return true},commandEnvironment:()=>({})};
    const service=createSpecifySetup({platform,store:createStore({root,identity,liveness})});
    service.check({reason:'activation'}).then(r=>{process.stdout.write(r.state);if(r.state!=='ready')process.exitCode=1});
  `;
  const results = await Promise.all(Array.from({ length: 3 }, () => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["-e", script, require.resolve("../specify-store"), require.resolve("../specify-setup"), root], { windowsHide: true });
    let out = ""; p.stdout.on("data", b => { out += b; }); p.stderr.on("data", b => { out += b; });
    p.on("error", reject); p.on("close", code => code ? reject(new Error(out)) : resolve(out));
  })));
  assert.deepEqual(results, ["ready", "ready", "ready"]);
  assert.equal((await fs.readFile(path.join(root, "installers"), "utf8")).trim().split("\n").length, 1);
  assert.equal(new Set((await fs.readFile(path.join(root, "terminals"), "utf8")).trim().split("\n")).size, 3);
});
