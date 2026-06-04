#!/usr/bin/env node
import { runAsk } from './ask-launcher.mjs';

if (!process.env.HEV_ASK_SUPPRESS_DEPRECATION) {
  console.warn('[hev-ask] `hev-ask-kg` is deprecated; use `ask kg ...`.');
}

process.exitCode = await runAsk(['kg', ...process.argv.slice(2)]);
