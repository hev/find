#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  { pkg: 'ask-darwin-arm64', goos: 'darwin', goarch: 'arm64', exe: 'ask' },
  { pkg: 'ask-darwin-x64', goos: 'darwin', goarch: 'amd64', exe: 'ask' },
  { pkg: 'ask-linux-arm64', goos: 'linux', goarch: 'arm64', exe: 'ask' },
  { pkg: 'ask-linux-x64', goos: 'linux', goarch: 'amd64', exe: 'ask' },
  { pkg: 'ask-win32-x64', goos: 'windows', goarch: 'amd64', exe: 'ask.exe' },
];

for (const target of targets) {
  const outDir = path.join(root, 'packages', target.pkg, 'bin');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, target.exe);
  const result = spawnSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', out, './cmd/ask'], {
    cwd: root,
    env: {
      ...process.env,
      CGO_ENABLED: '0',
      GOOS: target.goos,
      GOARCH: target.goarch,
      GOMODCACHE: process.env.GOMODCACHE ?? path.join(os.tmpdir(), 'hev-ask-gomodcache'),
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`[hev-ask] built ${target.pkg}/bin/${target.exe}`);
}
