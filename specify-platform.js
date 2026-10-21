"use strict";
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const { createHash } = require("node:crypto");
const https = require("node:https");

function sanitize(value) {
  return String(value).replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/([?&][^=\s&]+=)[^&\s]+/g, "$1[redacted]")
    .replace(/(\b(?:Bearer|Basic)\s+)\S+/gi, "$1[redacted]")
    .replace(/((?:password|token|secret|authorization|api_key)\s*[=:]\s*)\S+/gi, "$1[redacted]");
}
function environment(options = {}) {
  const { platform = process.platform, arch = process.arch, home = os.homedir(), env = process.env,
    hostname = os.hostname(), editor = "", remoteName, uiKind } = options;
  const p = platform === "win32" ? path.win32 : path.posix;
  const base = platform === "win32" ? (env.LOCALAPPDATA || p.join(home, "AppData", "Local")) :
    platform === "darwin" ? p.join(home, "Library", "Application Support") : (env.XDG_DATA_HOME || p.join(home, ".local", "share"));
  const root = p.resolve(base, "sdd-speckit");
  const inWorkspace = (options.workspaceRoots || []).some(workspace => { const relative = p.relative(workspace, root); return relative === "" || (!relative.startsWith("..") && !p.isAbsolute(relative)); });
  const supported = !inWorkspace && !remoteName && uiKind !== 2 && ["win32", "darwin", "linux"].includes(platform) && ["x64", "arm64"].includes(arch);
  return { key: createHash("sha256").update(`${hostname}\0${home}`).digest("hex"), platform, arch, root, editor, remoteName, uiKind, supported,
    reason: supported ? undefined : "Preparação local indisponível neste host. Prepare Specify no ambiente de destino conforme as instruções oficiais." };
}
const psPath = () => path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
function capture(executable, args) {
  return new Promise((resolve, reject) => execFile(executable, args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
    (e, stdout) => e ? reject(e) : resolve(stdout.trim())));
}
async function identity(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    if (process.platform === "linux") {
      const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8");
      return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    }
    if (process.platform === "win32") return await capture(psPath(), ["-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`]);
    return await capture("/bin/ps", ["-p", String(pid), "-o", "lstart="]);
  } catch { return null; }
}
async function liveness(child) {
  if (!child.pid || !child.startedAt) return "unknown";
  try { process.kill(child.pid, 0); }
  catch (e) {
    if (e.code !== "ESRCH") return "unknown";
    if (child.treeManaged === "group") {
      try { process.kill(-child.pid, 0); return "alive"; } catch (groupError) { return groupError.code === "ESRCH" ? "dead" : "unknown"; }
    }
    return "dead";
  }
  const current = await identity(child.pid);
  // PID reuse is ambiguous, never evidence permitting recovery.
  return current === child.startedAt ? "alive" : "unknown";
}

async function run(executable, args, options = {}) {
  if (!path.isAbsolute(executable)) throw new Error("Executable must be absolute");
  const { cwd, env = process.env, signal, timeout = 15000, beforeSpawn, onSpawn, onExit } = options;
  if (signal?.aborted) throw Object.assign(new Error("Process cancelled"), { code: "CANCELLED" });
  if (beforeSpawn) await beforeSpawn();
  return new Promise((resolve, reject) => {
    // Tracked Windows installers live in a kill-on-close Job Object. If the host
    // or wrapper dies, Windows kills every descendant, including detached ones.
    const job = process.platform === "win32" && !!beforeSpawn;
    const child = spawn(job ? psPath() : executable, job ? ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "specify-process.ps1")] : args,
      { cwd, env: job ? { ...env, SDD_PROCESS_EXE: executable, SDD_PROCESS_ARGS: JSON.stringify(args) } : env,
        shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), failure, stopping, closed = false, killedTree = false;
    const stop = (code, message) => {
      if (stopping || closed) return;
      failure = Object.assign(new Error(message), { code });
      stopping = (async () => {
        if (!child.pid) return;
        if (process.platform === "win32") {
          try { await capture(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"]); killedTree = true; }
          catch { /* A failed kill leaves the persistent child record in place. */ }
        } else {
          try { process.kill(-child.pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
        }
      })();
    };
    const abort = () => stop("CANCELLED", "Process cancelled");
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop("TIMEOUT", "Process timed out"), timeout);
    child.stdout.on("data", b => { stdout = Buffer.concat([stdout, b]).subarray(-65536); });
    child.stderr.on("data", b => { stderr = Buffer.concat([stderr, b]).subarray(-65536); });
    const registration = new Promise((done, fail) => {
      child.once("spawn", () => { Promise.resolve(onSpawn?.(child.pid, job ? "job" : process.platform !== "win32" ? "group" : undefined)).then(done, e => { stop("TRACKING_FAILED", e.message); fail(e); }); });
      child.once("error", done);
    });
    registration.catch(() => {});
    child.once("error", e => { failure = e; });
    child.once("close", async code => {
      closed = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      try {
        await registration; await stopping;
        // A remaining Unix process group is not safe to release.
        let treeExited = true;
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, 0); treeExited = false; } catch (e) { treeExited = e.code === "ESRCH"; }
        }
        // On Windows taskkill /T /F must succeed to establish tree termination.
        // If the process exited naturally the installer contract requires it to await children.
        if (onExit) await onExit(treeExited && (!failure || process.platform !== "win32" || killedTree));
        if (failure) throw failure;
        resolve({ code, stdout: sanitize(stdout.toString(options.outputEncoding || "utf8")), stderr: sanitize(stderr.toString(options.outputEncoding || "utf8")) });
      } catch (e) { reject(e); }
    });
    if (signal?.aborted) abort();
  });
}

function prependPath(env, bin, platform = process.platform) {
  const result = { ...env };
  const key = Object.keys(result).find(k => platform === "win32" ? k.toLowerCase() === "path" : k === "PATH") || "PATH";
  const delimiter = platform === "win32" ? ";" : ":";
  const equal = (a, b) => platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
  result[key] = [bin, ...(result[key] || "").split(delimiter).filter(p => p && !equal(p, bin))].join(delimiter);
  return result;
}
function quote(value, shell) {
  const name = path.basename(shell || "").toLowerCase();
  if (/^(powershell|pwsh)(\.exe)?$/.test(name)) return `'${String(value).replace(/['\u2018\u2019]/g, character => character + character)}'`;
  if (/^cmd(\.exe)?$/.test(name)) {
    if (/["%!\r\n]/.test(value)) throw new Error("Path cannot safely be represented in cmd; select PowerShell");
    return `"${value}"`;
  }
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}
function command(executable, args, shell) {
  return `${/^(powershell|pwsh)(\.exe)?$/i.test(path.basename(shell || "")) ? "& " : ""}${[executable, ...args].map(v => quote(v, shell)).join(" ")}`;
}
function managedEnvironment(root, source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !/^(UV_|PIP_|INSTALLER_|PYTHON|VIRTUAL_ENV|CONDA_PREFIX|NODE_TLS_REJECT_UNAUTHORIZED)/i.test(key)));
  return { ...env, UV_NO_CONFIG: "1", UV_TOOL_DIR: path.join(root, "tools"), UV_TOOL_BIN_DIR: path.join(root, "bin"),
    UV_PYTHON_INSTALL_DIR: path.join(root, "python"), UV_CACHE_DIR: path.join(root, "cache"),
    UV_UNMANAGED_INSTALL: path.join(root, "uv"), UV_NO_MODIFY_PATH: "1", UV_PYTHON_PREFERENCE: "only-managed",
    UV_DEFAULT_INDEX: "https://pypi.org/simple", NO_COLOR: "1", TERM: "dumb" };
}
async function download(url, destination, { signal, request = https.get, redirects = 4 } = {}) {
  const address = new URL(url);
  if (address.protocol !== "https:" || address.username || address.password) throw new Error("Installer requires HTTPS without credentials");
  if (!["astral.sh", "releases.astral.sh", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(address.hostname)) throw new Error("Installer redirect is not an official distribution host");
  if (signal?.aborted) throw new Error("Download cancelled");
  const bytes = await new Promise((resolve, reject) => {
    const req = request(address, { rejectUnauthorized: true, signal, timeout: 30000 }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (!redirects || !res.headers.location) { reject(new Error("Installer redirect limit")); return; }
        resolve({ redirect: new URL(res.headers.location, address).href }); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Installer HTTP ${res.statusCode}`)); return; }
      let size = 0; const chunks = [];
      res.on("data", chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) req.destroy(new Error("Installer exceeds size limit")); else chunks.push(chunk); });
      res.on("error", reject); res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("timeout", () => req.destroy(new Error("Download timed out")));
    req.on("error", reject);
  });
  if (bytes.redirect) return download(bytes.redirect, destination, { signal, request, redirects: redirects - 1 });
  await fs.writeFile(destination, bytes, { mode: 0o600, flag: "wx" });
}

function createPlatform(options = {}) {
  const context = { ...environment(options), ...(options.root ? { root: options.root } : {}) };
  const root = context.root;
  const execute = options.execute || run;
  const baseEnv = options.env || process.env;
  const win = context.platform === "win32";
  const suffix = win ? ".exe" : "";
  const neutral = async () => { await fs.mkdir(root, { recursive: true, mode: 0o700 }); return root; };
  const commandEnvironment = candidate => prependPath({ ...baseEnv, NO_COLOR: "1", TERM: "dumb" }, candidate.binDirectory, context.platform);
  async function probe(executable, { signal } = {}) {
    const candidate = { executable: path.resolve(executable), binDirectory: path.dirname(path.resolve(executable)),
      origin: path.relative(root, executable).startsWith("..") ? "external" : "managed", checkedAt: new Date().toISOString(), terminalVerified: false };
    try {
      const opts = { cwd: await neutral(), env: commandEnvironment(candidate), signal, timeout: 15000 };
      const version = await execute(candidate.executable, ["version"], opts);
      const init = await execute(candidate.executable, ["init", "--help"], opts);
      const integration = await execute(candidate.executable, ["integration", "install", "--help"], opts);
      candidate.version = version.stdout.trim();
      candidate.capabilities = { init: init.code === 0 && ["--here", "--integration", "--script"].every(f => init.stdout.includes(f)),
        integration: integration.code === 0 && ["--script", "--force"].every(f => integration.stdout.includes(f)) };
      candidate.compatible = version.code === 0 && candidate.capabilities.init && candidate.capabilities.integration;
    } catch (e) { if (signal?.aborted) throw e; candidate.compatible = false; candidate.error = sanitize(e.message); }
    return candidate;
  }
  function locations(name, hint) {
    const envPath = Object.entries(baseEnv).find(([k]) => win ? k.toLowerCase() === "path" : k === "PATH")?.[1] || "";
    const home = options.home || os.homedir();
    return [...new Set([hint, ...envPath.split(win ? ";" : ":").filter(p => path.isAbsolute(p)).map(p => path.join(p, name + suffix)),
      path.join(home, ".local", "bin", name + suffix), path.join(home, ".cargo", "bin", name + suffix),
      path.join(root, name === "uv" ? "uv" : "bin", name + suffix)].filter(p => p && path.isAbsolute(p)))];
  }
  async function discover(hint, opts) {
    let incompatible;
    for (const file of locations("specify", hint?.executable)) {
      try { await fs.access(file); } catch { continue; }
      const candidate = await probe(file, opts);
      if (candidate.compatible) return candidate;
      incompatible ||= candidate;
    }
    return incompatible;
  }
  async function install({ signal, attemptId, processHooks, stage, repair }) {
    await neutral();
    const env = managedEnvironment(root, baseEnv);
    const opts = { cwd: root, env, signal, timeout: 600000, ...processHooks };
    async function checked(exe, args) {
      const result = await execute(exe, args, opts);
      if (result.code !== 0) throw Object.assign(new Error(result.stderr || `Process exited ${result.code}`), { code: "PROCESS_FAILED", exitCode: result.code });
      options.log?.(sanitize(result.stdout)); return result;
    }
    let uv;
    stage("uv");
    for (const file of locations("uv")) {
      try {
        await fs.access(file);
        const result = await execute(file, ["tool", "install", "--help"], { cwd: root, env, signal, timeout: 15000 });
        if (result.code === 0 && ["--python", "--index-url"].every(f => result.stdout.includes(f))) { uv = file; break; }
      } catch (e) { if (signal.aborted) throw e; }
    }
    if (!uv) {
      const installer = path.join(root, `installer-${attemptId}.${win ? "ps1" : "sh"}`);
      try {
        await (options.download || download)(`https://astral.sh/uv/install.${win ? "ps1" : "sh"}`, installer, { signal });
        await checked(win ? psPath() : "/bin/sh", win ? ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", installer] : [installer]);
      } finally { await fs.rm(installer, { force: true }); }
      uv = path.join(root, "uv", "uv" + suffix);
    }
    const uvVersion = await checked(uv, ["--version"]);
    stage("python");
    await checked(uv, ["python", "install", "3.11", "--no-config"]);
    const python = await checked(uv, ["python", "find", "3.11", "--no-config"]);
    const pythonVersion = await checked(python.stdout.trim(), ["--version"]);
    stage("specify");
    await checked(uv, ["tool", "install", "--python", "3.11", "specify-cli==1.2.2", "--index-url", "https://pypi.org/simple", "--no-config", ...(repair ? ["--force"] : [])]);
    return { executable: path.join(root, "bin", "specify" + suffix), origin: "managed", resolvedVersions: { uv: uvVersion.stdout.trim(), python: pythonVersion.stdout.trim() } };
  }
  async function verifyTerminal(candidate, { signal, attemptId, allowFallback = false } = {}) {
    const profile = options.terminalProfile?.() || { shell: options.shell, env: {} };
    const shell = profile.shell;
    if (!shell || !path.isAbsolute(shell) || profile.unverifiable) return false;
    const name = path.basename(shell).toLowerCase().replace(/\.exe$/, "");
    if (!["powershell", "pwsh", "cmd", "bash", "zsh", "sh"].includes(name)) return false;
    const env = { ...baseEnv };
    for (const [key, value] of Object.entries(profile.env || {})) {
      if (win) for (const existing of Object.keys(env)) { if (existing.toLowerCase() === key.toLowerCase()) delete env[existing]; }
      if (value === null) delete env[key]; else env[key] = value;
    }
    const terminalEnv = prependPath(env, candidate.binDirectory, context.platform);
    options.applyPath?.(candidate.binDirectory);
    const token = attemptId || require("node:crypto").randomUUID();
    const scriptFile = path.join(await neutral(), `terminal-${token}.${name === "cmd" ? "cmd" : ["powershell", "pwsh"].includes(name) ? "ps1" : "sh"}`);
    let script, args;
    if (["powershell", "pwsh"].includes(name)) {
      script = `$ErrorActionPreference='Stop'\n[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding\n$command=Get-Command specify -ErrorAction Stop | Select-Object -First 1\nif ($command.CommandType -ne 'Application') { exit 1 }\n$p=$command.Source\n& $p version | Out-Null\n$c=$LASTEXITCODE\nWrite-Output ('${token}|' + $c + '|' + $p)\nexit $c\n`;
      args = [...(profile.args || []), "-NonInteractive", "-File", scriptFile];
    } else if (name === "cmd") {
      script = `@echo off\r\nset "sddResolved="\r\nfor /f "delims=" %%p in ('where specify') do if not defined sddResolved set "sddResolved=%%p"\r\n"%sddResolved%" version >nul\r\nset "sddCode=%errorlevel%"\r\necho ${token}|%sddCode%|%sddResolved%\r\nexit /b %sddCode%\r\n`.replace(`echo ${token}|%sddCode%|`, `echo ${token}^|%sddCode%^|`);
      args = ["/u", "/c", scriptFile];
    } else {
      script = `p=$(command -v specify)\n"$p" version >/dev/null\nc=$?\nprintf '%s|%s|%s\\n' '${token}' "$c" "$p"\nexit "$c"\n`;
      args = [...(profile.args || []), "-i", "-c", `. ${quote(scriptFile, shell)}`];
    }
    const resultFile = path.join(root, `terminal-${token}.result`);
    async function verified(result) {
      const line = result.stdout.replace(/^\uFEFF/, "").split(/\r?\n/).find(l => l.startsWith(token + "|0|"));
      if (result.code !== 0 || !line) return false;
      const resolved = await fs.realpath(line.slice(token.length + 3).trim());
      const expected = await fs.realpath(candidate.executable);
      return win ? resolved.toLowerCase() === expected.toLowerCase() : resolved === expected;
    }
    let terminal;
    try {
      await fs.writeFile(scriptFile, script, { mode: 0o600, flag: "wx" });
      try {
        const result = await execute(shell, args, { cwd: root, env: terminalEnv, signal, timeout: 15000, outputEncoding: name === "cmd" ? "utf16le" : "utf8" });
        if (await verified(result)) return true;
        options.log?.(sanitize(result.stderr));
      } catch (e) { if (signal?.aborted) throw e; options.log?.(sanitize(e.message)); }
      if (!allowFallback || !options.openVerificationTerminal) return false;
      // A dedicated integrated terminal supplies proof through a private file.
      // Merely dispatching this command never transitions the service to ready.
      await fs.writeFile(resultFile, "", { mode: 0o600, flag: "wx" });
      const invocation = ["powershell", "pwsh"].includes(name) ? `& ${quote(scriptFile, shell)} | Out-File -Encoding utf8 ${quote(resultFile, shell)}` :
        name === "cmd" ? `${quote(shell, shell)} /u /c ${quote(scriptFile, shell)} > ${quote(resultFile, shell)}` : `. ${quote(scriptFile, shell)} > ${quote(resultFile, shell)}`;
      terminal = options.openVerificationTerminal({ shell, args: profile.args, env: terminalEnv, cwd: root, command: invocation });
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && !signal?.aborted) {
        const stdout = await fs.readFile(resultFile, name === "cmd" ? "utf16le" : "utf8");
        if (stdout.includes(token)) return await verified({ code: 0, stdout });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      return false;
    } catch (e) { if (signal?.aborted) throw e; options.log?.(sanitize(e.message)); return false; }
    finally { terminal?.dispose(); await fs.rm(scriptFile, { force: true }); await fs.rm(resultFile, { force: true }); }
  }
  return { environment: context, identity, liveness, run: execute, probe, discover, install, verifyTerminal, commandEnvironment };
}

module.exports = { createPlatform, environment, run, identity, liveness, sanitize, prependPath, quote, command, managedEnvironment, download };
