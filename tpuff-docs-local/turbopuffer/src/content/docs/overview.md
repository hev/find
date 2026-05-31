---
title: "API Overview"
description: "All API calls require authenticating with your API key. You can create and expire tokens in the dashboard."
group: "API"
---

## Authentication

All API calls require authenticating with your API key. You can create and expire tokens in the [dashboard](/dashboard).

The HTTP API expects the API key to be formatted as a standard Bearer token and passed in the Authorization header:

```http
Authorization: Bearer <API_KEY>
```

## Encoding

The API uses JSON encoding for both request and response payloads.

## Compression

The API supports standard HTTP compression headers.

However, for most workloads, disabling compression offers the best performance.
turbopuffer clients are typically CPU constrained, not network bandwidth
constrained.

The official client libraries disable request and response compression by default.

## Error responses

If an error occurs for your request, all endpoints will return a JSON payload in the format:

```json
{
  "status": "error",
  "error": "an error message"
}
```

You may encounter an `HTTP 429` if you query or write too quickly. See [limits](/docs/limits) for more information.

## Asynchronous requests

Some long-running operations can run asynchronously rather than holding the connection open until they finish.
The official client libraries handle this transparently, so it is only relevant if you call the HTTP API directly.

Currently supported operations:

- [copy_from_namespace](/docs/write#param-copy_from_namespace)
- [recall evaluation](/docs/recall)

Send the `Prefer: respond-async` HTTP header to opt in.
The server starts the operation in the background and returns `202 Accepted` with a `Location` header pointing to the operation:

```http
HTTP/1.1 202 Accepted
Preference-Applied: respond-async
Location: /v1/namespaces/:namespace/operations/:token

{ "token": "<token>" }
```

Poll that location to check on the operation.
The response is `{ "status": "running" }` until it finishes.
Once finished, it carries the result:

```json
{
  "status": "finished",
  "result": {
    // exactly one of:
    "success": {
      "status": "OK",
      "message": "namespace cloned successfully"
    },
    "error": {
      "status_code": 400,
      "detail": {
        "status": "error",
        "error": "destination namespace already exists"
      }
    }
  }
}
```

Note that the `Prefer: respond-async` header is just a hint.
The server may return a sync response, for efficiency or load reasons.

## Specification

The API has a public OpenAPI specification available at:

https://github.com/turbopuffer/turbopuffer-openapi
