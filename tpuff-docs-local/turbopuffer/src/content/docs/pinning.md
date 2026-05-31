---
title: "Namespace Pinning"
description: "By default, namespaces run on turbopuffer's shared, multi-tenant query infrastructure. That is the right choice for most workloads."
group: "Operations"
---

```
                   ╔══turbopuffer region═════╗      ╔═══Object Storage═════════════════╗
                   ║      ┌────────────────┐ ║░     ║ ┏━━Indexing Queue━━━━━━━━━━━━━━┓ ║░
                   ║   ┌─▶│  ./tpuf query  │ ║░     ║ ┃■■■■■■■■■                     ┃ ║░
                ┌──╩─┐ │  └────────────────┘ ║░     ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
╔══════════╗    │    │ │  ┌────────────────┐ ║░     ║ ┏━/{org_id}/{namespace}━━━━━━━━┓ ║░
║  Client  ║───▶│ LB │─┼─▶│  ./tpuf query  │─╬─────▶║ ┃ ┏━/wal━━━━━━━━━━━━━━━━━━━━━┓ ┃ ║░
╚══════════╝░   │    │ │  └────────────────┘ ║░     ║ ┃ ┃■■■■■■■■■■■■■■■◈◈◈◈       ┃ ┃ ║░
 ░░░░░░░░░░░░   └──╦─┘ │  ┌────────────────┐ ║░     ║ ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┃ ║░
                   ║   │─▶│  ./tpuf query  │ ║░     ║ ┃ ┏━/index━━━━━━━━━━━━━━━━━━━┓ ┃ ║░
                   ║   │  │ [pin:org1/nsA] │ ║░     ║ ┃ ┃■■■■■■■■■■■■■■■           ┃ ┃ ║░
                   ║   │  └────────────────┘ ║░     ║ ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┃ ║░
                   ║   │  ┌────────────────┐ ║░     ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
                   ║   └─▶│  ./tpuf query  │ ║░     ╚══════════════════════════════════╝░
                   ║      │ [pin:org2/nsY] │ ║░      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                   ║      └────────────────┘ ║░
                   ╚═════════════════════════╝░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░
    
```

By default, namespaces run on turbopuffer's shared, multi-tenant query
infrastructure. That is the right choice for most workloads.

**Namespace pinning** reserves compute and NVMe SSD cache for a specific
namespace. Once pinned, that namespace's queries run on those reserved
resources, so its data stays hot, cost and performance stay predictable, and
sustained high query volume is often much cheaper.

## Multi-tenant vs. pinned

* **Multi-tenant** (default): Shared compute and cache. This is the simplest and
  most cost-effective option for most namespaces. Smart caching adapts to traffic
  patterns to minimize query latency. For spiky traffic, you can [warm the
  cache](/docs/warm-cache) to reduce cold starts.

* **Pinned**: Reserved compute and NVMe SSD cache for one namespace. This keeps
  the hot path warm and gives large, busy namespaces more predictable throughput,
  latency, and cost.

  Pinning also changes billing: instead of per-query (**TB Queried**) pricing,
  pinned namespaces are billed by **GB-hours** based on namespace size and how
  long the namespace stays pinned. That means the effective cost per query goes
  down as query volume goes up, with a break-even point typically around 10
  queries per second.

## When to use pinning

Pinning is a good fit when:

* **You run sustained high query volume** on a namespace, where **GB-hours** are
  cheaper than paying per query.
* **You want predictable query latency** on a namespace, where occasional cold
  queries would hurt your product.
* **You want predictable cost** on a namespace, where **GB-hours** are easier
  to forecast than per-query **TB Queried**.

For many small or naturally sharded namespaces, the default multi-tenant path
is still the best choice.

As a rule of thumb, pinning is worth evaluating when a large (>16 GB) namespace
sustains above 10 queries per second and you want more predictable cost and
performance.

## How it works

1. You turn pinning on for an existing namespace via the [metadata
   API](/docs/metadata#change-metadata).
2. turbopuffer loads the namespace into the SSD cache of reserved [query
   nodes](/docs/concepts#query-and-indexing-nodes).
3. All queries for that namespace route to those query nodes.
4. The namespace stays hot on those reserved SSDs for as long as it stays
   pinned.

Pinning usually takes less than 30 minutes. During that time, queries continue
to work on the existing path with no downtime.

Pinning does not change durability: data remains stored durably in object
storage whether pinned or not.

### Replicas

Replicas increase read throughput.

Each replica runs on its own reserved [query node](/docs/concepts#query-and-indexing-nodes),
and reads are load-balanced across them. Throughput scales linearly with replica
count.

A single replica can handle between 100 and 1000 QPS, depending on query shape,
filters, and namespace size. Filtered vector and full-text search queries fall
in the middle of this range.

To decide when to add replicas, monitor `pinning.status.utilization` on `GET
/v1/namespaces/:namespace/metadata` (see [Metadata](/docs/metadata#view-metadata)).
If utilization stays high or if queries return `HTTP 429 (Too Many Requests)`
errors, add more replicas to increase read capacity.

Replicas do not currently autoscale for a pinned namespace. Support for this is
planned.

Replicas also improve fault tolerance. If a replica hits a hardware failure,
turbopuffer will fail over and rewarm a new replica. With multiple replicas,
this is less likely to result in cold query latency reaching your application.
If you are okay with cold latency for a few minutes during a cloud hardware
failure, you do not need multiple replicas.

## Pricing

Pinned namespaces are billed by **GB-hours**:

`namespace size (GB) × replicas × hours pinned`

Queries served by a pinned namespace are not subject to **TB Queried**
usage-based pricing. At sustained query volume, this often makes individual
queries much cheaper than per-query pricing. Exact break-even depends on your
workload.

Billing has a floor of **64 GB** and **10 minutes**. A pinned namespace smaller
than 64 GB is billed as 64 GB, and a namespace pinned for less than 10 minutes
is billed for 10 minutes.

Use the calculator below to compare multi-tenant and pinned pricing based on
namespace size and QPS.

## Configuration

Configure pinning with `PATCH /v1/namespaces/:namespace/metadata` (see
[Metadata](/docs/metadata#change-metadata)).

Set `pinning` to `true` to pin with default settings and 1 replica.

Set `pinning` to `null` to unpin.

Inspect current settings with `GET /v1/namespaces/:namespace/metadata`.

**Example: Enable pinning with 2 replicas**

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v1/namespaces/pinning-enable-example-curl/metadata \
  -X PATCH --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "pinning": {
      "replicas": 2
    }
  }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'pinning-enable-example-py')
ns.update_metadata(
    pinning={
        'replicas': 2,
    }
)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`pinning-enable-example-ts`);
await ns.updateMetadata({
  pinning: {
    replicas: 2,
  },
});
```
```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
	"github.com/turbopuffer/turbopuffer-go/v2/packages/param"
)

func main() {
	ctx := context.Background()
	client := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := client.Namespace("pinning-enable-example-go")
	_, err = ns.UpdateMetadata(ctx, turbopuffer.NamespaceUpdateMetadataParams{
		NamespaceMetadataPatch: turbopuffer.NamespaceMetadataPatchParam{
			Pinning: turbopuffer.PinningConfigParam{
				Replicas: turbopuffer.Int(2),
			},
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("Pinning enabled")
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class EnablePinning {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("pinning-enable-example-java");

    ns.updateMetadata(
      NamespaceMetadataPatch.builder().pinning(PinningConfig.builder().replicas(2L).build()).build()
    );
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

var ns = tpuf.Namespace("pinning-enable-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.UpdateMetadata(
    new NamespaceUpdateMetadataParams { Pinning = new PinningConfig { Replicas = 2 } }
);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("pinning-enable-example-rb")
ns.update_metadata(pinning: { replicas: 2 })
```
<!-- /multilang -->

**Example: Disable pinning**

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v1/namespaces/pinning-disable-example-curl/metadata \
  -X PATCH --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "pinning": null
  }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'pinning-disable-example-py')
ns.update_metadata(pinning=None)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`pinning-disable-example-ts`);
await ns.updateMetadata({
  pinning: null,
});
```
```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
	"github.com/turbopuffer/turbopuffer-go/v2/packages/param"
)

func main() {
	ctx := context.Background()
	client := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := client.Namespace("pinning-disable-example-go")
	_, err = ns.UpdateMetadata(ctx, turbopuffer.NamespaceUpdateMetadataParams{
		NamespaceMetadataPatch: turbopuffer.NamespaceMetadataPatchParam{
			Pinning: param.NullStruct[turbopuffer.PinningConfigParam](),
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("Pinning disabled")
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class DisablePinning {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("pinning-disable-example-java");

    ns.updateMetadata(NamespaceMetadataPatch.builder().pinning(false).build());
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

var ns = tpuf.Namespace("pinning-disable-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.UpdateMetadata(new NamespaceUpdateMetadataParams { Pinning = false });
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("pinning-disable-example-rb")
ns.update_metadata(pinning: nil)
```
<!-- /multilang -->
