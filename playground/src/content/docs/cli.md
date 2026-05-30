---
title: CLI Reference
description: Install, authenticate, and run pipelines from the command line.
group: Reference
order: 2
---

The `layer` CLI is the primary way to manage pipelines locally and in CI.

## Authentication

Authenticate once with `layer auth login`; credentials are cached in your home
directory. Use `layer pipeline run ./pipeline.toml` to start a pipeline from a
config file, and `layer pipeline ls` to list running pipelines and their lag.

## Pipeline commands

Common commands:

- `layer auth login` — authenticate the CLI.
- `layer pipeline run <file>` — start a pipeline from a config file.
- `layer pipeline ls` — list pipelines and current lag.
- `layer pipeline logs <id>` — tail logs for a running pipeline.
- `layer sink test <name>` — send a test record to verify a sink connection.
