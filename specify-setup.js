"use strict";
const { randomUUID } = require("node:crypto");
const { sanitize } = require("./specify-platform");

function createSpecifySetup({ platform, store, report = () => {} }) {
  let snapshot = { state: "idle", stage: "detect", recoveryActions: [] };
  let pending, controller, disposed = false;
  const listeners = new Set();
  function publish(change) {
    snapshot = { ...snapshot, ...change };
    for (const listener of listeners) { try { listener(structuredClone(snapshot)); } catch { /* UI cannot break locking. */ } }
    try { report(structuredClone(snapshot)); } catch { /* Diagnostics are not orchestration. */ }
    return structuredClone(snapshot);
  }
  function cancelled() {
    if (controller.signal.aborted) throw Object.assign(new Error("Preparation cancelled"), { code: "CANCELLED" });
  }
  async function perform(trigger) {
    controller = new AbortController();
    let lock, previous, persist = false, heartbeat, tracking = Promise.resolve(), children = [];
    const attemptId = randomUUID();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 600000);
    const explicit = trigger === "retry" || trigger === "repair";
    publish({ state: "checking", stage: "detect", trigger, attemptId, error: undefined, installation: undefined, recoveryActions: [] });
    try {
      if (!platform.environment.supported) return publish({ state: "unsupported", error: { code: "UNSUPPORTED", stage: "detect", message: platform.environment.reason }, recoveryActions: ["manual"] });
      previous = await store.read();
      cancelled();
      let activeLock = await store.readLock();
      if (activeLock && explicit && await store.recover()) activeLock = null;
      if (activeLock) {
        publish({ state: "waiting", stage: "lock", recoveryActions: ["cancel", "recheck"] });
        while (activeLock) {
          cancelled();
          if (await platform.liveness({ pid: activeLock.ownerPid, startedAt: activeLock.ownerStartedAt }) !== "alive") {
            return publish({ state: "interrupted", recoveryActions: ["retry", "manual"] });
          }
          await new Promise(resolve => setTimeout(resolve, 250));
          activeLock = await store.readLock();
        }
        previous = await store.read();
      }
      let installation = await platform.discover(previous?.installation, { signal });
      async function validate(candidate) {
        cancelled();
        publish({ state: "checking", stage: "terminal", installation: candidate });
        const terminalVerified = await platform.verifyTerminal(candidate, { signal, attemptId, allowFallback: ["retry", "repair", "recheck"].includes(trigger) });
        cancelled();
        const result = publish({ state: terminalVerified ? "ready" : "verification-required", installation: { ...candidate, terminalVerified },
          recoveryActions: terminalVerified ? [] : ["recheck", "manual"],
          error: terminalVerified ? undefined : { code: "TERMINAL_PENDING", stage: "terminal", message: "Reabra o terminal/editor e verifique novamente; o perfil precisa resolver a mesma cópia do Specify." } });
        if (!lock) lock = await store.acquire(attemptId);
        if (lock) await store.write({ ...result, automaticAttemptConsumed: true, finishedAt: new Date().toISOString() });
        return result;
      }
      if (installation?.compatible && trigger !== "repair") return await validate(installation);
      if (installation && trigger !== "repair") return publish({ state: previous?.installation ? "repair-required" : "incompatible", installation, recoveryActions: ["repair", "recheck", "manual"] });
      if (!explicit && (previous?.automaticAttemptConsumed || previous?.installation || trigger !== "activation")) {
        return publish({ state: previous?.installation ? "repair-required" : (previous?.state === "installing" ? "interrupted" : previous?.state || "repair-required"),
          error: previous?.error, recoveryActions: ["retry", "recheck", "manual"] });
      }
      publish({ stage: "lock" });
      lock = await store.acquire(attemptId);
      if (!lock && explicit && await store.recover()) lock = await store.acquire(attemptId);
      if (!lock) {
        publish({ state: "waiting", recoveryActions: ["cancel", "recheck"] });
        while (await store.readLock()) {
          cancelled();
          // Never recover implicitly, and never wait forever for an orphan.
          const owner = await store.readLock();
          if (owner && await platform.liveness({ pid: owner.ownerPid, startedAt: owner.ownerStartedAt }) !== "alive") {
            return publish({ state: "interrupted", recoveryActions: ["retry", "manual"] });
          }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        cancelled();
        installation = await platform.discover((await store.read())?.installation, { signal });
        if (installation?.compatible) return await validate(installation);
        return publish({ state: "repair-required", recoveryActions: ["retry", "recheck", "manual"] });
      }
      previous = await store.read();
      installation = await platform.discover(previous?.installation, { signal });
      cancelled();
      if (installation?.compatible && (trigger !== "repair" || installation.origin === "managed")) return await validate(installation);
      if (installation && trigger !== "repair") return publish({ state: "incompatible", recoveryActions: ["repair", "recheck", "manual"] });
      if (!explicit && previous?.automaticAttemptConsumed) return publish({ state: "repair-required", recoveryActions: ["retry", "recheck"] });
      await store.write({ state: "installing", stage: "uv", trigger, attemptId, automaticAttemptConsumed: true, startedAt: new Date().toISOString(), finishedAt: undefined });
      persist = true;
      publish({ state: "installing", stage: "uv" });
      const track = value => {
        if (value) children = value;
        tracking = tracking.then(() => store.updateLock(lock, children));
        return tracking;
      };
      heartbeat = setInterval(() => { void track().catch(() => controller.abort()); }, 5000);
      const processHooks = {
        beforeSpawn: () => track([{ pid: null, startedAt: null }]),
        onSpawn: async (pid, treeManaged) => track([{ pid, startedAt: await platform.identity(pid), treeManaged }]),
        onExit: async confirmed => { if (confirmed) await track([]); },
      };
      installation = await platform.install({ signal, attemptId, processHooks, repair: trigger === "repair", stage: stage => { cancelled(); publish({ state: "installing", stage }); } });
      cancelled();
      publish({ stage: "validate" });
      const resolvedVersions = installation?.resolvedVersions;
      installation = await platform.discover(installation, { signal });
      if (installation) installation.resolvedVersions = resolvedVersions;
      if (!installation?.compatible) throw Object.assign(new Error("Installed CLI failed capability checks"), { code: "VALIDATION_FAILED" });
      return await validate(installation);
    } catch (e) {
      const result = publish({ state: signal.aborted ? "cancelled" : "failed", error: { code: e.code || "SETUP_FAILED", stage: snapshot.stage,
        message: sanitize(e.message), ...(e.exitCode !== undefined ? { exitCode: e.exitCode } : {}) }, recoveryActions: ["retry", "recheck", "manual"] });
      if (persist) {
        try { await store.write({ ...result, finishedAt: new Date().toISOString() }); }
        catch (error) { publish({ error: { code: "PERSISTENCE_FAILED", stage: snapshot.stage, message: sanitize(error.message) } }); }
      }
      return structuredClone(snapshot);
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      try { await tracking; } catch { /* Release still verifies the persistent child record. */ }
      if (lock) {
        try { await store.release(lock); }
        catch (e) { publish({ state: "interrupted", error: { code: e.code || "LOCK_RETAINED", stage: "lock", message: sanitize(e.message) }, recoveryActions: ["retry", "manual"] }); }
      }
    }
  }
  function start(trigger) {
    if (disposed) return Promise.resolve(structuredClone(snapshot));
    if (!pending) pending = perform(trigger).then(() => structuredClone(snapshot)).finally(() => { pending = undefined; });
    return pending;
  }
  return {
    get snapshot() { return structuredClone(snapshot); },
    subscribe(listener) { listeners.add(listener); return { dispose: () => listeners.delete(listener) }; },
    check: ({ reason = "recheck" } = {}) => start(reason), retry: () => start("retry"), repair: () => start("repair"),
    async ensureReady() {
      if (pending) return { ready: false, snapshot: structuredClone(snapshot) };
      const value = await start("command");
      return { ready: value.state === "ready", executable: value.installation?.executable,
        env: value.installation ? platform.commandEnvironment(value.installation) : undefined, snapshot: value };
    },
    async cancel() { controller?.abort(); await pending; },
    async dispose() { disposed = true; controller?.abort(); await pending; listeners.clear(); },
  };
}

module.exports = { createSpecifySetup };
