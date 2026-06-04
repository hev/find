#!/usr/bin/env node
import { runAsk } from './ask-launcher.mjs';

process.exitCode = await runAsk(process.argv.slice(2));
