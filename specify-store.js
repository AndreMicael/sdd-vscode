"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function fault(code, message) { return Object.assign(new Error(message), { code }); }

function createStore({ root, identity, liveness }) {
  const stateFile = path.join(root, "state.json");
  const lockFile = path.join(root, "install.lock");
  const recoveryFile = path.join(root, "recovery.lock");
  async function readJson(file) {
    let text;
    try { text = await fs.readFile(file, "utf8"); }
    catch (e) { if (e.code === "ENOENT") return null; throw e; }
    let value;
    try { value = JSON.parse(text); } catch { throw fault("CORRUPT_STATE", `Unreadable state: ${path.basename(file)}`); }
    if (!value || value.schemaVersion !== 1) throw fault("UNKNOWN_SCHEMA", "Unknown state schema; preserve file and use manual recovery");
    return value;
  }
  async function atomic(file, value) {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  async function read() {
    const value = await readJson(stateFile);
    if (value && (typeof value.automaticAttemptConsumed !== "boolean" || !["idle", "checking", "installing", "ready", "failed", "cancelled", "unsupported", "waiting", "incompatible", "interrupted", "verification-required", "repair-required"].includes(value.state))) {
      throw fault("CORRUPT_STATE", "Invalid state fields; explicit manual recovery required");
    }
    return value;
  }
  async function write(value) {
    const previous = await read(); // Unknown/corrupt data never means a first run.
    await atomic(stateFile, { ...previous, ...value, schemaVersion: 1,
      automaticAttemptConsumed: !!(previous?.automaticAttemptConsumed || value.automaticAttemptConsumed), updatedAt: new Date().toISOString() });
  }
  async function exclusive(file, value) {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    let handle;
    try { handle = await fs.open(file, "wx", 0o600); }
    catch (e) { if (e.code === "EEXIST") return false; throw e; }
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); }
    finally { await handle.close(); }
    return true;
  }
  async function acquire(attemptId) {
    // A recovery guard, including an orphan, blocks all new owners.
    try { await fs.access(recoveryFile); return null; } catch (e) { if (e.code !== "ENOENT") throw e; }
    const lock = { schemaVersion: 1, token: randomUUID(), attemptId, ownerPid: process.pid,
      ownerStartedAt: await identity(process.pid), heartbeatAt: new Date().toISOString(), childProcesses: [] };
    if (!lock.ownerStartedAt) throw fault("IDENTITY_UNKNOWN", "Cannot establish process identity");
    if (!await exclusive(lockFile, lock)) return null;
    return lock;
  }
  async function owned(lock) {
    const current = await readJson(lockFile);
    if (!current || current.token !== lock.token) throw fault("LOCK_TOKEN", "Lock token changed");
    return current;
  }
  async function updateLock(lock, childProcesses) {
    const current = await owned(lock);
    await atomic(lockFile, { ...current, heartbeatAt: new Date().toISOString(), childProcesses });
  }
  async function childrenDead(lock) {
    for (const child of lock.childProcesses || []) {
      if (!child.pid || !child.startedAt || await liveness(child) !== "dead") return false;
    }
    return true;
  }
  async function release(lock) {
    const current = await owned(lock);
    if (!await childrenDead(current)) throw fault("CHILDREN_ACTIVE", "Cannot release lock: children active or unknown");
    await fs.unlink(lockFile);
  }
  async function recover() {
    const token = randomUUID();
    if (!await exclusive(recoveryFile, { schemaVersion: 1, token, ownerPid: process.pid })) return false;
    try {
      const current = await readJson(lockFile);
      if (!current) return true;
      const dead = async () => current.ownerStartedAt &&
        await liveness({ pid: current.ownerPid, startedAt: current.ownerStartedAt }) === "dead" && await childrenDead(current);
      if (!await dead()) return false;
      if ((await readJson(lockFile))?.token !== current.token || !await dead()) return false;
      // Consume automatic eligibility even if the owner died before its state write.
      await write({ state: "interrupted", automaticAttemptConsumed: true,
        error: { code: "INTERRUPTED", stage: "lock", message: "Previous owner stopped; explicit retry required" }, recoveryActions: ["retry", "recheck", "manual"] });
      await fs.unlink(lockFile);
      return true;
    } finally {
      if ((await readJson(recoveryFile))?.token === token) await fs.unlink(recoveryFile);
    }
  }
  return { read, write, acquire, release, updateLock, recover, readLock: () => readJson(lockFile) };
}

module.exports = { createStore };
