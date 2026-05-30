---
title: Installation
description: Get Layer running locally with Docker or the native binary.
group: Overview
order: 2
---

There are two supported ways to install Layer: the native binary and the Docker
image.

For the native binary, download the release for your platform and place it on
your `PATH`. Verify the install with `layer --version`. The binary is
self-contained and has no runtime dependencies.

To run with Docker, pull `ghcr.io/layer/layer:latest` and mount your config
directory. The provided `docker-compose.yml` brings up Layer alongside a local
Aerospike instance for development, so you can test pipelines end to end without
provisioning cloud infrastructure.
