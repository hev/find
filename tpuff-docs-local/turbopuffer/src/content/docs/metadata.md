---
title: "Metadata"
description: "GET /v1/namespaces/:namespace/metadata"
group: "API"
---

## View Metadata

GET /v1/namespaces/:namespace/metadata

Returns metadata about a namespace.

## Response

**schema** object

See the [schema documentation](/docs/write#schema).

---

**approx_logical_bytes** integer

The approximate number of logical bytes in the namespace.

This is a coarse approximation and may change over time as turbopuffer's
data representation evolves.

When using [`disable_backpressure`](/docs/write#param-disable_backpressure), this metric will not be updated until all data has been indexed.

---

**approx_row_count** integer

The approximate number of rows in the namespace.

When using [`disable_backpressure`](/docs/write#param-disable_backpressure), this metric will not be updated until all data has been indexed.

---

**created_at** string

The timestamp when the namespace was created, in ISO 8601 format.

Example: `"2024-03-15T10:30:45Z"`

---

**last_write_at** string

The timestamp when the namespace's data was last modified, in ISO 8601 format.

Example: `"2024-03-19T09:12:14Z"`

---

**updated_at** string

The timestamp when the namespace when the namespace's data or schema
was last modified, in ISO 8601 format.

Example: `"2024-04-16T09:27:32Z"`

---

**encryption** object

Describes how the namespace is encrypted.

- Default server-side encryption: `{ "mode": "default" }`
- [CMEK](/docs/cmek): `{ "mode": "customer-managed", "key_name": "…" }`

```jsonc
  // GCP Example
  { "mode": "customer-managed",
    "key_name": "projects/myproject/locations/us-central1/keyRings/EXAMPLE/cryptoKeys/KEYNAME" }
  // AWS Example
  { "mode": "customer-managed",
    "key_name": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012" }
```

---

**index** object

The state of the [index](/docs/architecture) for the namespace. Contains the
following fields:

- `status` (string): `updating` or `up-to-date`

- `unindexed_bytes` (integer):

  The number of bytes in the namespace that are in the [write-ahead log](/docs/architecture)
  but have not yet been indexed. Note that unindexed data is still searched by queries
  (see [consistency](/docs/query#param-consistency) for details).

  Only present when `status` is `updating`.

---

**pinning** object

[Namespace pinning](/docs/pinning) provisions reserved compute for a namespace
to provide predictable cost and performance for large namespaces with sustained
query volume, with always-warm cache.

Only present when the namespace is pinned.

Contains the following fields:

- `replicas` (integer): The number of read replicas configured for the namespace.
  Each replica increases read throughput.

- `status` (object): Operational status for the pinned namespace. When
  available, includes the number of `ready_replicas` that are warm and able to
  serve traffic, along with the average `utilization` of all ready replicas.

  When `utilization` exceeds 90%, consider increasing replica count.

Example: `{ "replicas": 2, "status": { "ready_replicas": 1, "utilization": 0.73 } }`

---

**branching** object

The state of [branching](/docs/branching) for the namespace. Only present for
branched namespaces. Contains the following fields:

- `parent` (string): The namespace this was branched from.

## Example

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v1/namespaces/metadata-curl/metadata \
  -X GET --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY"

# Response payload
# {
#   "schema": {
#     "id": {
#       "type": "uint"
#     },
#     "vector": {
#       "type": "[2]f32",
#       "ann": {
#         "distance_metric": "cosine_distance"
#       }
#     },
#     "my-number": {
#       "type": "uint",
#       "filterable": true,
#       "full_text_search": null
#     }
#   },
#   "approx_size_bytes": 4398046511104,
#   "approx_num_rows": 720,
#   "created_at": "2024-03-15T10:30:45Z",
#   "updated_at": "2024-04-16T09:27:32Z",
#   "encryption": {
#     "sse": true
#   },
#   "index": {
#     "status": "updating",
#     "unindexed_bytes": 128
#   }
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f"metadata-inspect-example-py")

metadata = ns.metadata()
print(metadata)  # returns a turbopuffer.NamespaceMetadata object
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`metadata-inspect-example-ts`);

const metadata = await ns.metadata();
console.log(metadata); // Prints a Turbopuffer.NamespaceMetadata object
```
```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("metadata-inspect-example-go")

	metadata, err := ns.Metadata(ctx, turbopuffer.NamespaceMetadataParams{})
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(metadata)) // returns a turbopuffer.NamespaceMetadata struct
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class MetadataInspect {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("metadata-inspect-example-java");

    Object metadata = ns.metadata();
    System.out.println(metadata); // returns a NamespaceMetadata object
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("metadata-inspect-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var metadata = await ns.Metadata(new NamespaceMetadataParams());
Console.WriteLine(metadata); // returns a NamespaceMetadata object
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("metadata-inspect-example-rb")

puts ns.metadata # outputs a Turbopuffer::NamespaceMetadata object
```
<!-- /multilang -->

## Billing

This request is billed as a query that returns zero rows.

---

## Change Metadata

PATCH /v1/namespaces/:namespace/metadata

Updates metadata configuration for a namespace.

Updates the configuration for a namespace.

Currently used to configure [namespace pinning](/docs/pinning).

### Request

**pinning** object

Configuration for [namespace pinning](/docs/pinning), which provisions reserved
compute for a namespace to provide predictable cost and performance for large
namespaces with sustained query volume, with always-warm cache.

Set to `null` to remove pinning from a namespace.

Contains the following fields:

- `replicas` (integer, optional): The number of read replicas to provision.
  Defaults to `1`. Each replica runs on its own reserved node, increases read
  throughput, and multiplies pinning cost.

**Example (enable pinning):**

```json
{
  "pinning": {
    "replicas": 2
  }
}
```

You can also enable pinning with the defaults (1 replica):

```json
{
  "pinning": true
}
```

**Example (disable pinning):**

```json
{
  "pinning": null
}
```

### Response

Returns the updated namespace metadata. See [View Metadata](#view-metadata) response
fields for details.

### Billing

This request is billed as a query that returns zero rows.
