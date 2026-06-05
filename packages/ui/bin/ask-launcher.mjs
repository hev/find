import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export async function runAsk(args, options = {}) {
  const target = resolveAskTarget();
  if (!target) {
    const platform = `${process.platform}/${process.arch}`;
    console.error(
      `[hev-ask] No ask binary is available for ${platform}. ` +
        'Install a package with @hevmind/ask optional binaries, set HEV_ASK_BINARY, or run from a source checkout with Go installed.',
    );
    return 1;
  }

  return run(target.command, [...target.args, ...args], {
    cwd: target.cwd,
    env: options.env ?? process.env,
  });
}

function resolveAskTarget() {
  const explicit = process.env.HEV_ASK_BINARY;
  if (explicit) return { command: explicit, args: [] };

  const packaged = resolvePackagedBinary();
  if (packaged) return { command: packaged, args: [] };

  const sourceRoot = findSourceRoot();
  if (sourceRoot) return { command: 'go', args: ['run', path.join(sourceRoot, 'cmd', 'ask')], cwd: process.cwd() };

  return null;
}

function resolvePackagedBinary() {
  const packageName = platformPackageName();
  if (!packageName) return null;
  try {
    const packageJson = require.resolve(`${packageName}/package.json`);
    const candidate = path.join(path.dirname(packageJson), 'bin', executableName());
    return existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function platformPackageName() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin' && arch === 'arm64') return '@hevmind/ask-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return '@hevmind/ask-darwin-x64';
  if (platform === 'linux' && arch === 'arm64') return '@hevmind/ask-linux-arm64';
  if (platform === 'linux' && arch === 'x64') return '@hevmind/ask-linux-x64';
  if (platform === 'win32' && arch === 'x64') return '@hevmind/ask-win32-x64';
  return null;
}

function executableName() {
  return process.platform === 'win32' ? 'ask.exe' : 'ask';
}

function findSourceRoot() {
  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const goMod = path.join(current, 'go.mod');
    const main = path.join(current, 'cmd', 'ask', 'main.go');
    if (existsSync(goMod) && existsSync(main) && isHevAskModule(goMod)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function isHevAskModule(goMod) {
  try {
    return readFileSync(goMod, 'utf8').includes('module github.com/hev/ask');
  } catch {
    return false;
  }
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', (err) => {
      console.error(`[hev-ask] Could not start ${command}: ${err.message}`);
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
