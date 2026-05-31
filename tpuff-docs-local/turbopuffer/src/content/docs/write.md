---
title: "Write documents"
description: "POST /v2/namespaces/:namespace"
group: "API"
---

POST /v2/namespaces/:namespace

Creates, updates, or deletes documents.

| | p50 | p90 | p99 |
|---|---|---|---|
| Upsert latency (500kb docs) | 285ms | 370ms | 688ms |

A `:namespace` is an isolated set of documents and is implicitly created when
the first document is inserted. Namespace names must match `[A-Za-z0-9-_.]{1,128}`.

We recommend creating a namespace per isolated document space instead of filtering when possible.
Large batches of writes are highly encouraged to maximize throughput and minimize cost. Write requests
can have a payload size of up to 512 MB. See [Performance](/docs/performance).

Within a namespace, documents are uniquely referred to by their ID. Document IDs are unsigned 64-bit
integers, 128-bit UUIDs, or strings up to 64 bytes.

[arch]: /architecture

turbopuffer supports the following types of writes:

- [Upserts](#param-upsert_rows): creates or overwrites an entire document.
- [Patches](#param-patch_rows): updates one or more attributes of an existing document.
- [Deletes](#param-deletes): deletes an entire document by ID.
- [Conditional writes](#param-upsert_condition): upsert, patch, or delete a document only if a condition.
- [Patch by filter](#param-patch_by_filter): patches documents that match a filter.
- [Delete by filter](#param-delete_by_filter): deletes documents that match a filter.
- [Copy from namespace](#param-copy_from_namespace): copies all documents from another namespace.
- [Branch from namespace](#param-branch_from_namespace): instantly creates a copy-on-write clone of a namespace.

## Request

**upsert_rows** array

Upserts documents in a row-based format. Each row is an object with an `id` document ID,
and any number of other [attribute](#attributes) fields.

Existing documents with matching IDs are overwritten entirely. Use [patch_rows](#param-patch_rows) to
update only specific attributes.

A namespace may or may not have vector indexes. If it does, all documents must include all vector attributes.

**Example:** `[{"id": 1, "vector": [1, 2, 3], "name": "foo"}, {"id": 2, "vector": [4, 5, 6], "name": "bar"}]`

---

**upsert_columns** object

Upserts documents in a column-based format. This field is an object, where each
key is the name of a column, and each value is an array of values for that
column.

Existing documents with matching IDs are overwritten entirely. Use [patch_columns](#param-patch_columns) to
update only specific attributes.

The `id` key is required, and must contain an array of document IDs. All vector attribute columns are required if
the namespace has vector indexes. Other keys will be stored as [attributes](#attributes).

Each column must be the same length. When a document doesn't have a value for a
given column, pass `null`.

**Example:** `{"id": [1, 2], "vector": [[1, 2, 3], [4, 5, 6]], "name": ["foo", "bar"]}`

---

**patch_rows** array

Patches documents in a row-based format. Identical to
[`upsert_rows`](#param-upsert_rows), but instead of overwriting entire
documents, only the specified keys are written.

Vector attributes currently cannot be patched. You currently need to retrieve and upsert the entire document.

Any patches to IDs that don't already exist in the namespace will be ignored;
patches will not create any missing documents.

**Example:** `[{"id": 1, "name": "baz"}, {"id": 2, "name": "qux"}]`

Patches are billed for the size of the patched attributes (not the full written
documents), plus the cost of one query per write request (to read all the patched
documents touched by the request).

---

**patch_columns** object

Patches documents in a column-based format. Identical to
[`upsert_columns`](#param-upsert_columns), but instead of overwriting entire
documents, only the specified keys are written.

Vector attributes currently cannot be patched. You currently need to retrieve and upsert the entire document.

Any patches to IDs that don't already exist in the namespace will be ignored;
patches will not create any missing documents.

**Example:** `{"id": [1, 2], "name": ["baz", "qux"]}`

---

**deletes** array

Deletes documents by ID. Must be an array of document IDs.

**Example:** `[1, 2, 3]`

---

**upsert_condition** object

Makes each write in [`upsert_rows`](#param-upsert_rows) and
[`upsert_columns`](#param-upsert_columns) [conditional](#conditional-writes) on the
`upsert_condition` being satisfied for the document with the corresponding ID.

The `upsert_condition` is evaluated before each write, using the current value
of the document with the matching ID.

* If the document exists and the condition is met, the write is applied (i.e.
  the document is updated).
* If the document exists and the condition is not met, the
  write is skipped.
* If the document does not exist, the write is applied unconditionally (i.e. the
  document is created).

The condition syntax matches the [`filters` parameter in the query
API](query#filtering), with an additional feature: you can reference the new value
being written using `$ref_new` references. These look like `{"$ref_new": "attr_123"}`
and can be used in place of value literals.

**Example:** `["Or", [["updated_at", "Lt", {"$ref_new": "updated_at"}], ["updated_at", "Eq", null]]]`

This condition ensures that each upsert is only processed if the new document
value has a newer "updated_at" timestamp than its current version.

**Example:** `["id", "Eq", null]`

This condition ensures that each upsert only inserts new documents, skipping
any writes where a document with that ID already exists. Since existing documents
always have a non-null `id`, this condition fails for them, while new documents
are inserted unconditionally.

---

**patch_condition** object

Like `upsert_condition`, but for [`patch_rows`](#param-patch_rows) and
[`patch_columns`](#param-patch_columns).

Any patches to IDs that don't already exist in the namespace will be ignored
without evaluating the condition; patches will not create any missing documents.

Does not apply to `patch_by_filter`. Prefer this over `patch_by_filter` when
the set of IDs to conditionally patch is known ahead of time.

---

**delete_condition** object

Like `upsert_condition`, but for [`deletes`](#param-deletes).

`$ref_new` references are given a `null` value for all attributes.

Does not apply to `delete_by_filter`. Prefer this over `delete_by_filter` when
the set of IDs to conditionally delete is known ahead of time.

---

**patch_by_filter** object

You can patch documents that match a filter using [`patch_by_filter`](#patch-by-filter).
It accepts an object with two fields:
  - `filters`: a filter expression (see [query filtering](query#filtering))
  - `patch`: an object containing the the patch to apply to all documents matching the filter

If `patch_by_filter` is used in the same request as other write operations, it is applied after `delete_by_filter` but before any other write operations.

Vector attributes currently cannot be patched. You currently need to retrieve and upsert the entire document.

**Example:**
```
{ "filters": ["page_id", "Eq", 123], "patch": { "page_id": 124 } }
```

`patch_by_filter` is billed as a write and two queries (one for the filter, one for the patch).

---

**delete_by_filter** object

You can delete documents that match a filter using [`delete_by_filter`](#delete-by-filter).
It has the same syntax as the [`filters` parameter in the query API](query#filtering).

If `delete_by_filter` is used in the same request as other write operations,
`delete_by_filter` will be applied before the other operations. This allows you
to delete rows that match a filter before writing new row with overlapping IDs.
Note that patches to any deleted rows are ignored.

`delete_by_filter` is different from `deletes` with a `delete_condition`:

* `delete_by_filter`: searches across the namespace for any matching document
  IDs, deleting all matches that it finds.
* `delete` + `delete_condition`: only evaluates the condition on the IDs
  identified in `deletes`.

`delete_condition` does not apply to `delete_by_filter`.

**Example:** `["page_id", "Eq", 123]`

`delete_by_filter` is billed the same as normal deletes, plus the cost of one
query per write request (to determine which IDs to delete).

---

**patch_by_filter_allow_partial** boolean
default: false

Allows `patch_by_filter` operations to succeed when the filter matches more than the [maximum allowed](/docs/limits) number of documents.

When set to `true`, a `patch_by_filter` will update up to the maximum allowed number of documents, and set `rows_remaining` to `true` if any additional documents could match this filter. You should issue another potentially duplicate request to
update additional matching documents.

When set to `false`, a `patch_by_filter` which matches more than the maximum allowed number of documents will *fail* and update no documents.

---

**delete_by_filter_allow_partial** boolean
default: false

Allows `delete_by_filter` operations to succeed when the filter matches more than the [maximum allowed](/docs/limits) number of documents.

When set to `true`, a `delete_by_filter` will delete up to the maximum allowed number of documents, and set `rows_remaining` to `true` if any additional documents could match this filter. You should issue another potentially duplicate request to
delete additional matching documents.

When set to `false`, a `delete_by_filter` which matches more than the maximum allowed number of documents will *fail* and update no documents.

---

**return_affected_ids** boolean
default: false

If `true`, the response will include `upserted_ids`, `patched_ids`, and
`deleted_ids` arrays containing the IDs of documents that were successfully
written.

For conditional writes and filter-based operations, only IDs for writes that
succeeded will be included.

---

**distance_metric** cosine_distance | euclidean_squared
required unless copy_from_namespace or branch_from_namespace is set or the namespace has no vector columns

The function used to calculate vector similarity. Possible values are `cosine_distance` or `euclidean_squared`.

`cosine_distance` is defined as `1 - cosine_similarity` and ranges from 0 to 2.
 Lower is better.

`euclidean_squared` is defined as `sum((x - y)^2)`. Lower is better.

**NOTE:** This distance metric will apply to all vector columns configured for this namespace.

---

**copy_from_namespace** string | object

Copy all documents from another namespace into this one. The destination namespace
you are copying into must be empty. The initial request currently cannot make
schema changes or contain documents.

Copying is billed at up to a 75% write discount (a 50% copy discount that stacks
with the up to 50% discount for batched writes). This is a faster, cheaper
alternative to re-upserting documents for backups and namespaces that share
documents. See the [cross-region backups guide](/docs/backups) for an example.
For same-region use cases, consider [`branch_from_namespace`](/docs/branching)
which completes instantly regardless of namespace size.

For copies from another region, the logical size copied is also billed as
returned bytes. Same-region copies do not bill returned bytes.

To copy a namespace from a different organization, region, or cloud provider, instead of providing the
namespace as a string, provide an object with the following fields:

  - `source_namespace` (string): the namespace to copy from
  - `source_api_key` (string, optional): an API key for the organization containing the source namespace. Omit to copy from the same organization as the target namespace.
  - `source_region` (string, optional): the [region](/docs/regions) of the source namespace (e.g. `"aws-us-east-1"`). Omit to copy from the same region as the target namespace. Source and destination can be in different cloud providers (e.g. `aws-us-east-1` → `gcp-us-central1`).

By default, the destination namespace will inherit the source namespace's encryption
configuration. You can optionally specify a different [encryption](#param-encryption)
for the destination namespace. This allows you to copy from a namespace with default encryption
to a namespace with customer-managed encryption, or vice-versa, or to use a different CMEK key
than the source.

For cross-region copies from a namespace with customer-managed encryption, you must explicitly specify a
destination encryption key available in the destination region.

**Example (basic copy):** `"source-namespace"`

**Example (cross-region, cross-org copy):**

```json
{
  "source_namespace": "source-namespace",
  "source_api_key": "tpuf_A1...",
  "source_region": "aws-us-east-1"
}
```

Copies of large namespaces can run asynchronously.
See [Asynchronous requests](/docs/overview#asynchronous-requests).

---

**branch_from_namespace** string

Creates an instant copy-on-write clone of the source namespace. The destination
namespace must be empty.

After branching, both namespaces are fully independent — reads, writes, queries,
and deletes on one namespace do not affect the other.

Branching is billed at a flat rate of $0.032 (pricing may change before GA). See
the [branching guide](/docs/branching) for details, examples, and guidance on
when to use branching vs `copy_from_namespace`.

**Example:** `"source-namespace"`

---

**schema** object

By default, the schema is inferred from the passed data. See [Schema](#schema) below.

There are cases where you want to manually specify the schema because
turbopuffer can't automatically infer it. For example, to specify UUID types,
configure full-text search for an attribute, or disable filtering for an attribute.

**Example:** `{"permissions": "[]uuid", "text": {"type": "string", "full_text_search": true}, "encrypted_blob": {"type": "string", "filterable": false}}`

---

**encryption** object
optional

Only available as part of our scale and enterprise [plans](/pricing).

Setting a [Customer Managed Encryption Key (CMEK)](/docs/cmek) will encrypt all data in a namespace using a secret coming from your cloud KMS.
Once set, all subsequent writes to this namespace will be encrypted, but data written prior to this upsert will be unaffected.

Currently, turbopuffer does not re-encrypt data when you rotate key versions, meaning old data will remain encrypted using older key verisons, while fresh writes will be encrypted using the latest versions.
**Revoking old key versions will cause data loss.**
To re-encrypt your data using a more recent key, use the [export](/docs/export) API to re-upsert into a new namespace,
or use [`copy_from_namespace`](#param-copy_from_namespace) with a different `encryption` key to copy to a newly encrypted namespace.

**Example (GCP):** `{ "mode": "customer-managed", "key_name": "projects/myproject/locations/us-central1/keyRings/EXAMPLE/cryptoKeys/KEYNAME" }`

**Example (AWS):** `{ "mode": "customer-managed", "key_name": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012" }`

---

**disable_backpressure** boolean
default: false

Disables HTTP 429 backpressure on writes when unindexed data exceeds 2 GiB. Useful for initial data loading or bulk updates. When disabled, strongly consistent queries return errors above this threshold, so use [eventual consistency](/docs/query#param-consistency) instead. Eventually consistent queries search only the first 128 MiB of unindexed data.

Only takes effect for upserts and delete-by-id. Ignored for patch-by-id, patch-by-filter, delete-by-filter, and [conditional writes](#conditional-writes), since those operations require a strongly consistent read of existing rows.

Indexing progress can be tracked through the `unindexed_bytes` field in the [metadata endpoint](/docs/metadata#responsefield-index).

Note that while data is being indexed, the following will not be updated:
- [`approx_row_count`](/docs/metadata#responsefield-approx_row_count) and [`approx_logical_bytes`](/docs/metadata#responsefield-approx_logical_bytes) in the metadata endpoint
- Namespace row counts and sizes in the dashboard

## Response

**rows_affected** number

The total number of rows affected by the write request (sum of upserted, patched, and deleted rows).

**rows_upserted** number

The number of rows upserted by the write request. Only present when [upsert_rows](#param-upsert_rows) or [upsert_columns](#param-upsert_columns) is used.

**rows_patched** number

The number of rows patched by the write request. Only present when [patch_rows](#param-patch_rows) or [patch_columns](#param-patch_columns) or [patch_by_filter](#param-patch_by_filter) is used.

When using [`patch_condition`](#param-patch_condition), this reflects only the rows where the condition was met and the patch was applied. Other patches were skipped.

**rows_deleted** number

The number of rows deleted by the write request. Only present when [deletes](#param-deletes) or [delete_by_filter](#param-delete_by_filter) is used.

When using [`delete_condition`](#param-delete_condition), this reflects only the rows where the condition was met and the deletion occurred. Other deletes were skipped.

**rows_remaining** boolean

Filter-based writes like `delete_by_filter` and `patch_by_filter` have a maximum
number of documents modified per write request. This ensures indexing and
consistent reads can keep up with writes & deletes. If this response field is
set to `true` there are more documents that match the `delete_by_filter` or
`patch_by_filter`. You should issue another potentially duplicate request to
update additional matching documents.

The [limits](/docs/limits) are currently:
- 5M documents for `delete_by_filter`
- 50k documents for `patch_by_filter`

**upserted_ids** array

The IDs of documents that were upserted. Only present when `return_affected_ids`
is `true` and at least one document was upserted.

**patched_ids** array

The IDs of documents that were patched. Only present when `return_affected_ids`
is `true` and at least one document was patched.

**deleted_ids** array

The IDs of documents that were deleted. Only present when `return_affected_ids`
is `true` and at least one document was deleted.

**billing** object

The billable resources consumed by the write. The object contains the following fields:

* `billable_logical_bytes_written` (uint): the number of logical bytes written to the namespace
* `query` (object, optional): query billing information when the write involves a query-like operation (for a conditional write, `patch_by_filter`, `delete_by_filter`, or a cross-region `copy_from_namespace`):
  * `billable_logical_bytes_queried` (uint): the number of logical bytes processed by queries
  * `billable_logical_bytes_returned` (uint): the number of logical bytes returned by queries

**performance** object

The performance metrics for the write. The object currently contains the following fields, but these fields may change name, type, or meaning in the future:

* `server_total_ms` (uint): request time measured on the server, in milliseconds

## Attributes

Documents are composed of attributes. All documents must have a unique `id` attribute. Attribute names
can be up to 128 characters in length and must not start with a `$` character.

By default, attributes are indexed and thus queries can [filter](/docs/query#filtering) or
[sort](/docs/query#ordering-by-attributes) by them. To disable indexing for an attribute, set
`filterable` to `false` in the [schema](/docs/write#param-filterable) for a 50% discount and
improved indexing performance. The attribute can still be returned, but not used for filtering or sorting.

Attributes must have consistent value types, and are nullable. The type is inferred from the first
occurrence of the attribute. Certain non-inferrable types, e.g. `uuid` or `datetime`, must be
specified in the [schema](/docs/write#schema).

Some limits apply to attribute sizes and number of attribute names per
namespace. See [Limits](/docs/limits).

### Vectors

Vectors are attributes with a vector type (`[N]f32` or `[N]f16` where N is the number of dimensions), encoded as either a JSON array of numbers, or as a base64-encoded string.
Attributes named `vector` will automatically be inferred as having vector types, additional vector columns must be explicitly declared in the [schema](/docs/write#schema).

If using the base64 encoding, the vector must be serialized in little-endian
float32 binary format, then base64-encoded. The base64 string encoding can be
more efficient on both the client and server.

Elements of a vector attribute must have the same number of dimensions.

A namespace can currently be created with up to  vector columns. The number of vector columns cannot be changed after namespace creation.

To use `f16` vectors within the database, the relevant vector attribute must be [explicitly
specified in the schema](/docs/write#param-type) with an `f16` type (e.g. `[512]f16`) when first creating the
namespace. This does not affect the base64 vector encoding in the API, which
always uses a little-endian float32 binary format.

Vector attributes require an ANN index, configured via the [`ann` schema parameter](/docs/write#param-ann).

#### Multiple vector columns

A namespace can have multiple vector columns, each with independent dimensions and types. Vector columns must be declared in the schema and are fixed at namespace creation time.

**Pricing:** Each vector column has its own ANN index. Filterable attributes are indexed per ANN index, so their write and storage costs scale with the number of vector columns. Non-filterable attributes are stored once regardless of the number of vector columns. See [attribute billing](/pricing#faq-attribute-billing) for details.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-multivec-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {"id": 1, "title_embedding": [0.1, 0.2, 0.3], "image_embedding": [0.4, 0.5], "title": "hello world"},
    {"id": 2, "title_embedding": [0.4, 0.5, 0.6], "image_embedding": [0.7, 0.8], "title": "goodbye world"}
  ],
  "distance_metric": "cosine_distance",
  "schema": {
    "title_embedding": {"type": "[3]f32", "ann": true},
    "image_embedding": {"type": "[2]f16", "ann": true}
  }
}'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-multivec-example-py')

ns.write(
    upsert_rows=[
        {
            'id': 1,
            'title_embedding': [0.1, 0.2, 0.3],
            'image_embedding': [0.4, 0.5],
            'title': 'hello world',
        },
        {
            'id': 2,
            'title_embedding': [0.4, 0.5, 0.6],
            'image_embedding': [0.7, 0.8],
            'title': 'goodbye world',
        },
    ],
    distance_metric='cosine_distance',
    schema={
        'title_embedding': {
            'type': '[3]f32',
            'ann': True,
        },
        'image_embedding': {
            'type': '[2]f16',
            'ann': True,
        },
    },
)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-multivec-example-ts`);

await ns.write({
  upsert_rows: [
    {
      id: 1,
      title_embedding: [0.1, 0.2, 0.3],
      image_embedding: [0.4, 0.5],
      title: "hello world",
    },
    {
      id: 2,
      title_embedding: [0.4, 0.5, 0.6],
      image_embedding: [0.7, 0.8],
      title: "goodbye world",
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    title_embedding: {
      type: "[3]f32",
      ann: true,
    },
    image_embedding: {
      type: "[2]f16",
      ann: true,
    },
  },
});
```
```go
package main

import (
	"context"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
	"github.com/turbopuffer/turbopuffer-go/v2/packages/param"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("write-multivec-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":              1,
					"title_embedding": []float32{0.1, 0.2, 0.3},
					"image_embedding": []float32{0.4, 0.5},
					"title":           "hello world",
				},
				{
					"id":              2,
					"title_embedding": []float32{0.4, 0.5, 0.6},
					"image_embedding": []float32{0.7, 0.8},
					"title":           "goodbye world",
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"title_embedding": {
					Type: "[3]f32",
					Ann:  param.Override[turbopuffer.AttributeSchemaConfigAnnParam](true),
				},
				"image_embedding": {
					Type: "[2]f16",
					Ann:  param.Override[turbopuffer.AttributeSchemaConfigAnnParam](true),
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class WriteMultivec {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-multivec-example-java");

    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("title_embedding", List.of(0.1f, 0.2f, 0.3f))
            .put("image_embedding", List.of(0.4f, 0.5f))
            .put("title", "hello world")
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("title_embedding", List.of(0.4f, 0.5f, 0.6f))
            .put("image_embedding", List.of(0.7f, 0.8f))
            .put("title", "goodbye world")
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .schema(
          Schema.builder()
            .put(
              "title_embedding",
              AttributeSchemaConfig.builder().type("[3]f32").ann(true).build()
            )
            .put(
              "image_embedding",
              AttributeSchemaConfig.builder().type("[2]f16").ann(true).build()
            )
            .build()
        )
        .build()
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-multivec-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("title_embedding", new[] { 0.1f, 0.2f, 0.3f })
                .Set("image_embedding", new[] { 0.4f, 0.5f })
                .Set("title", "hello world"),
            new Row()
                .Set("id", 2)
                .Set("title_embedding", new[] { 0.4f, 0.5f, 0.6f })
                .Set("image_embedding", new[] { 0.7f, 0.8f })
                .Set("title", "goodbye world"),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["title_embedding"] = new AttributeSchemaConfig { Type = "[3]f32", Ann = true },
            ["image_embedding"] = new AttributeSchemaConfig { Type = "[2]f16", Ann = true },
        },
    }
);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-multivec-example-rb")

ns.write(
  upsert_rows: [
    {
      id: 1,
      title_embedding: [0.1, 0.2, 0.3],
      image_embedding: [0.4, 0.5],
      title: "hello world",
    },
    {
      id: 2,
      title_embedding: [0.4, 0.5, 0.6],
      image_embedding: [0.7, 0.8],
      title: "goodbye world",
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    title_embedding: {
      type: "[3]f32",
      ann: true,
    },
    image_embedding: {
      type: "[2]f16",
      ann: true,
    },
  },
)
```
<!-- /multilang -->

## Schema

turbopuffer maintains a schema for each namespace with type and indexing behaviour for each attribute. By default, types are automatically inferred from the passed data and every attribute is indexed. To inspect the schema, use the [metadata endpoint](/docs/metadata).

To customize indexing behavior or to specify types that cannot be automatically inferred (e.g. `uuid`), you can pass a `schema` object in a write request. This can be done on every write, or only the first; there's no performance difference. If a new attribute is added, this attribute will default to null for any documents that existed before the attribute was added.

Changing the attribute type of an existing attribute is currently an error.

For an example, see [Configuring the schema](/docs/write#configuring-the-schema).

**type** string
required

The data type of the attribute. Supported types:

- `string`: String
- `int`: Signed integer (i64)
- `uint`: Unsigned integer (u64)
- `float`: Floating-point number (f64)
- `uuid`: 128-bit UUID
- `datetime`: Date and time
- `bool`: Boolean
- `[]string`: Array of strings
- `[]int`: Array of signed integers
- `[]uint`: Array of unsigned integers
- `[]float`: Array of floating-point numbers
- `[]uuid`: Array of UUIDs
- `[]datetime`: Array of dates and times
- `[]bool`: Array of booleans
- `[N]f32`: `N` dimensional f32 vector
- `[N]f16`: `N` dimensional f16 vector
- `{}f16`: Sparse vector with string keys and [16-bit floats](https://en.wikipedia.org/wiki/Half-precision_floating-point_format) as weights. Example: `{"dim0": 0.1, "dim1": 0.2}`.

All attributes are nullable, except for `id`.

`string`, `int` and `bool` types and their array variants can be inferred from
the write payload. Other types, such as `uint` or `uuid` must be set explicitly in the schema. See [UUID
values](/docs/write#configuring-the-schema) for an example.

`datetime` values should be provided as an ISO 8601 formatted string with a
mandatory date and optional time and time zone. Internally, these values are
converted to UTC (if the time zone is specified) and stored as a 64-bit integer
representing milliseconds since the epoch.

**Example:** `["2015-01-20", "2015-01-20T12:34:56", "2015-01-20T12:34:56-04:00"]`

`{}f16` attributes are not filterable and require indexing for fast `SparseKNN` operations.

---

**ann** boolean
required true for vector types

Must be set to `true` for vector type attributes (`[N]f32`, `[N]f16`). Builds an approximate nearest neighbor index for the vector column, enabling fast vector queries via [`rank_by`](/docs/query#param-rank_by).

**Example:** `"my_vector": {"type": "[512]f16", "ann": true}`

---

**filterable** boolean
default: true (false if full-text search or regex is enabled)

Whether or not the attribute can be used in
[filters](/docs/query#filtering-parameters)/WHERE clauses. Filtered attributes are
indexed into an inverted index. At query-time, the [filter evaluation is
recall-aware](/blog/native-filtering) when used for vector queries.

Unfiltered attributes don't have an index built for them, and are thus billed at a 50% discount (see [pricing](/#pricing)).

---

**regex** boolean
default: false

Whether to enable [Regex](/docs/query#param-Regex) filters on this attribute. If set, `filterable` defaults to `false`; you can override this by setting `filterable: true`.

---

**glob** boolean
default: false

Whether to enable [Glob](/docs/query#param-Glob) filters on this attribute. If set, `filterable` defaults to `false`; you can override this by setting `filterable: true`.

---

**fuzzy** boolean
default: false

Whether to enable [Fuzzy](/docs/query#param-Fuzzy) filters on this attribute. If set, `filterable` defaults to `false`; you can override this by setting `filterable: true`.

---

**full_text_search** boolean | object
default: false

Whether this attribute can be used as part of a [BM25 full-text
search](/docs/fts). Requires the `string` or `[]string` type,
and by default, BM25-enabled attributes are not filterable. You can
override this by setting `filterable: true`.

Can either be a boolean for default settings, or an object with the following optional fields:

- `tokenizer` (string): How to convert the text to a list of tokens. Defaults to `word_v3`. The default is periodically upgraded for new namespaces. See: [Supported tokenizers](/docs/fts#tokenizers)
- `case_sensitive` (boolean): Whether searching is case-sensitive. Defaults to `false` (i.e. case-insensitive).
- `language` (string): The language of the text. Defaults to `english`. See: [Supported languages](/docs/fts/#supported-languages)
- `stemming` (boolean): Language-specific stemming for the text. Defaults to `false` (i.e. do not stem).
- `remove_stopwords` (boolean): Removes [common words][stopwords] from the text based on `language`. Defaults to `false` (i.e. keep common words).
- `ascii_folding` (boolean): Whether to convert each non-ASCII character in a token to its ASCII equivalent, if one exists (e.g., à -> a). Applied after stemming and stopword removal. Defaults to `false` (i.e., no folding).
- `max_token_length` (int): Maximum length of a token in bytes. Tokens larger than this value during tokenization will be filtered out. Has to be between `1` and `254` (inclusive). Defaults to `39`.
- `k1` (float): Term frequency saturation parameter for BM25 scoring. Must be greater than zero. Defaults to `1.2`. See: [Advanced tuning](/docs/fts#advanced-tuning)
- `b` (float): Document length normalization parameter for BM25 scoring. Must be in the range `[0.0, 1.0]`. Defaults to `0.75`. See: [Advanced tuning](/docs/fts#advanced-tuning)
- `k3` (float): Query term frequency saturation parameter for BM25 scoring. Must be greater than zero. Defaults to `8.0`. See: [Advanced tuning](/docs/fts#advanced-tuning)

If you require other types of full-text search options, please [contact us](/contact).

[stopwords]: https://snowballstem.org/algorithms/english/stop.txt

---

**sparse_knn** object
default: unset

When configured, this attribute can be used as part of a `SparseKNN` query.
This is only supported on the `{}f16` type.

This requires a `distance_metric` string field, which only supports
`dot_product` as a value at the moment.

### Updating attributes

We support online, in-place changes of the following schema attributes:

- `filterable`
- `full_text_search`
- `regex`
- `glob`
- `fuzzy`

The write does not need to include any documents, i.e. `{"schema": ...}` is supported, provided the namespace already exists.

Other index settings changes, attribute type changes, and attribute deletions
currently cannot be done in-place. Consider [exporting](/docs/export) documents
and upserting into a new namespace if you require a schema change.

    After enabling the `filterable`, `full_text_search`, `regex`, `glob`, or `fuzzy` setting for an existing attribute, the index needs time to build before queries that depend on the index can be executed. turbopuffer will respond with HTTP status 202 to queries that depend on an index that is not yet built.

    Changing full-text search parameters also requires that the index be rebuilt. turbopuffer will do this automatically in the background, during which time queries will continue returning results using the previous full-text search settings.

### Billing

An unindexed attribute is billed at 50% of its logical size. Indexed attributes are based on their logical
size multiplied by the number of indexes they have enabled. For example, an attribute with with `filterable: true`
and `full_text_search: true` is billed at 200% of its logical size.

## Examples

### Row-based writes

Row-based writes may be more convenient than column-based writes. You can pass
any combination of `upsert_rows`, `patch_rows`, `patch_by_filter`, `deletes`, and
`delete_by_filter` to the write request.

If the same document ID appears multiple times in the request, the request will
fail with an HTTP 400 error.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-upsert-row-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "distance_metric": "cosine_distance",
  "upsert_rows": [
    {
      "id": 1,
      "vector": [0.1, 0.1],
      "my-string": "one",
      "my-uint": 12,
      "my-bool": true,
      "my-string-array": ["a", "b"]
    },
    {
      "id": 2,
      "vector": [0.2, 0.2],
      "my-string-array": ["b", "d"]
    }
  ],
  "patch_rows": [
    {
      "id": 3,
      "my-bool": true
    }
  ],
  "deletes": [4]
}'

# Response payload
# {
#   "status": "OK"
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-upsert-row-example-py')
# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': [0.1, 0.1],
            'my-string': 'one',
            'my-uint': 12,
            'my-bool': True,
            'my-string-array': ['a', 'b']
        },
        {
            'id': 2,
            'vector': [0.2, 0.2],
            'my-string-array': ['b', 'd']
        },
    ],
    patch_rows=[
        {
            'id': 3,
            'my-bool': True
        },
    ],
    deletes=[4],
    distance_metric='cosine_distance'
)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-upsert-row-example-ts`);

await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: [0.1, 0.1],
      "my-string": "one",
      "my-uint": 12,
      "my-bool": true,
      "my-string-array": ["a", "b"],
    },
    {
      id: 2,
      vector: [0.2, 0.2],
      "my-string-array": ["b", "d"],
    }
  ],
  patch_rows: [
    {
      id: 3,
      "my-bool": true,
    }
  ],
  deletes: [4],
  distance_metric: "cosine_distance",
});
```
```go
package main

import (
	"context"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("write-upsert-row-example-go")
	// If an error occurs, this call raises an error if a retry was not successful.
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":              1,
					"vector":          []float32{0.1, 0.1},
					"my-string":       "one",
					"my-uint":         12,
					"my-bool":         true,
					"my-string-array": []string{"a", "b"},
				},
				{
					"id":              2,
					"vector":          []float32{0.2, 0.2},
					"my-string-array": []string{"b", "d"},
				},
			},
			PatchRows: []turbopuffer.RowParam{
				{
					"id":      3,
					"my-bool": true,
				},
			},
			Deletes:        []any{4},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;
import java.util.stream.*;

public class WriteUpsertRow {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-upsert-row-example-java");
    // If an error occurs, this call raises a TurbopufferServiceException if a retry was not successful.
    ns.write(
      NamespaceWriteParams.builder()
        .upsertRows(
          List.of(
            Row.builder()
              .put("id", 1)
              .put("vector", List.of(0.1f, 0.1f))
              .put("my-string", "one")
              .put("my-uint", 12)
              .put("my-bool", true)
              .put("my-string-array", List.of("a", "b"))
              .build(),
            Row.builder()
              .put("id", 2)
              .put("vector", List.of(0.2f, 0.2f))
              .put("my-string-array", List.of("b", "d"))
              .build()
          )
        )
        .patchRows(List.of(Row.builder().put("id", 3).put("my-bool", true).build()))
        .addDelete(4)
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-upsert-row-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));
// If an error occurs, this call raises a TurbopufferApiException if a retry was not successful.
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("vector", new[] { 0.1f, 0.1f })
                .Set("my-string", "one")
                .Set("my-uint", 12)
                .Set("my-bool", true)
                .Set("my-string-array", new[] { "a", "b" }),
            new Row()
                .Set("id", 2)
                .Set("vector", new[] { 0.2f, 0.2f })
                .Set("my-string-array", new[] { "b", "d" }),
        ],
        PatchRows = [new Row().Set("id", 3).Set("my-bool", true)],
        Deletes = [4L],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-upsert-row-example-rb")
# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: [0.1, 0.1],
      'my-string': "one",
      'my-uint': 12,
      'my-bool': true,
      'my-string-array': ["a", "b"],
    },
    {
      id: 2,
      vector: [0.2, 0.2],
      'my-string-array': ["b", "d"],
    },
  ],
  patch_rows: [
    {
      id: 3,
      'my-bool': true,
    },
  ],
  deletes: [4],
  distance_metric: "cosine_distance",
)
```
<!-- /multilang -->

### Configuring the schema

The [schema](/docs/write#schema) can be passed on writes to manually configure attribute types and indexing behavior. A few examples where manually configuring the schema is needed:

- **UUID** values serialized as strings can be stored in turbopuffer in an optimized format.
- Enabling **full-text search**, **regex**, **glob**, or **fuzzy** indexing for string attributes.
- **Disabling indexing/filtering** (`filterable:false`) on an attribute, for a 50% discount and improved indexing performance.

An example of (1), (2), and (3):

<!-- multilang -->
```bash
# Make a POST request using curl
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-schema-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {"id": "769c134d-07b8-4225-954a-b6cc5ffc320c", "vector": [0.1, 0.1], "text": "the fox is quick and brown", "string": "fox", "permissions": ["ee1f7c89-a3aa-43c1-8941-c987ee03e7bc", "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e"]}
  ],
  "distance_metric": "cosine_distance",
  "schema": {
    "id": "uuid",
    "text": {
      "type": "string",
      "full_text_search": true
    },
    "permissions": {
      "type": "[]uuid"
    }
  }
}'

# Response payload
# {
#   "status": "OK"
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-schema-example-py')

ns.write(
    upsert_rows=[
        {
            'id': "769c134d-07b8-4225-954a-b6cc5ffc320c",
            'vector': [0.1, 0.1],
            'text': 'the fox is quick and brown',
            'string': 'fox',
            'permissions': ['ee1f7c89-a3aa-43c1-8941-c987ee03e7bc', '95cdf8be-98a9-4061-8eeb-2702b6bbcb9e']
        },
    ],
    distance_metric='cosine_distance',
    schema={
        'id': 'uuid',
        'text': {
            'type': 'string',
            'full_text_search': True # sets filterable: false, and enables FTS with default settings
        },
        'permissions': {
            'type': '[]uuid', # otherwise inferred as slower/more expensive []string
        }
    }
)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-schema-example-ts`);

await ns.write({
  upsert_rows: [
    {
      id: "769c134d-07b8-4225-954a-b6cc5ffc320c",
      vector: [0.1, 0.1],
      text: "the fox is quick and brown",
      string: "fox",
      permissions: ["ee1f7c89-a3aa-43c1-8941-c987ee03e7bc", "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e"],
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    id: "uuid",
    text: {
      type: "string",
      full_text_search: true, // sets filterable: false, and enables FTS with default settings
    },
    permissions: {
      type: "[]uuid", // otherwise inferred as slower/more expensive []string
    },
  },
});
```
```go
package main

import (
	"context"
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

	ns := tpuf.Namespace("write-schema-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":          "769c134d-07b8-4225-954a-b6cc5ffc320c",
					"vector":      []float32{0.1, 0.1},
					"text":        "the fox is quick and brown",
					"string":      "fox",
					"permissions": []string{"ee1f7c89-a3aa-43c1-8941-c987ee03e7bc", "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e"},
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"id": {Type: "uuid"},
				"text": {
					Type: "string",
					// sets filterable: false, and enables FTS with default settings
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{},
				},
				// Otherwise inferred as slower/more expensive []string
				"permissions": {Type: "[]uuid"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class WriteSchema {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-schema-example-java");

    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", "769c134d-07b8-4225-954a-b6cc5ffc320c")
            .put("vector", List.of(0.1f, 0.1f))
            .put("text", "the fox is quick and brown")
            .put("string", "fox")
            .put(
              "permissions",
              List.of(
                "ee1f7c89-a3aa-43c1-8941-c987ee03e7bc",
                "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e"
              )
            )
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .schema(
          Schema.builder()
            .put("id", AttributeSchemaConfig.builder().type("uuid").build())
            .put(
              "text",
              AttributeSchemaConfig.builder()
                .type("string")
                // Sets filterable(false), and enables FTS with default settings
                .fullTextSearch(FullTextSearchConfig.defaults())
                .build()
            )
            .put(
              "permissions",
              AttributeSchemaConfig.builder()
                .type("[]uuid") // otherwise inferred as slower/more expensive []string
                .build()
            )
            .build()
        )
        .build()
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-schema-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", "769c134d-07b8-4225-954a-b6cc5ffc320c")
                .Set("vector", new[] { 0.1f, 0.1f })
                .Set("text", "the fox is quick and brown")
                .Set("string", "fox")
                .Set(
                    "permissions",
                    new[]
                    {
                        "ee1f7c89-a3aa-43c1-8941-c987ee03e7bc",
                        "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e",
                    }
                ),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["id"] = new AttributeSchemaConfig { Type = "uuid" },
            ["text"] = new AttributeSchemaConfig
            {
                Type = "string",
                // Sets filterable(false), and enables FTS with default settings
                FullTextSearch = true,
            },
            ["permissions"] = new AttributeSchemaConfig
            {
                Type = "[]uuid", // otherwise inferred as slower/more expensive []string
            },
        },
    }
);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-schema-example-rb")

ns.write(
  upsert_rows: [
    {
      id: "769c134d-07b8-4225-954a-b6cc5ffc320c",
      vector: [0.1, 0.1],
      text: "the fox is quick and brown",
      string: "fox",
      permissions: ["ee1f7c89-a3aa-43c1-8941-c987ee03e7bc", "95cdf8be-98a9-4061-8eeb-2702b6bbcb9e"],
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    id: "uuid",
    text: {
      type: "string",
      full_text_search: true, # sets filterable: false, and enables FTS with default settings
    },
    permissions: {
      type: "[]uuid", # otherwise inferred as slower/more expensive []string
    },
  },
)
```
<!-- /multilang -->

### Column-based writes

Bulk document operations should use a column-oriented layout for best
performance. You can pass any combination of `upsert_columns`, `patch_columns`,
`deletes`, and `delete_by_filter` to the write request.

If the same document ID appears multiple times in the request, the request will
fail with an HTTP 400 error.

<!-- multilang -->
```bash
# Make a POST request using curl
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-upsert-columns-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_columns": {
    "id": [1, 2, 3, 4],
    "vector": [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
    "my-string": ["one", null, "three", "four"],
    "my-uint": [12, null, 84, 39],
    "my-bool": [true, null, false, true],
    "my-string-array": [["a", "b"], ["b", "d"], [], ["c"]]
  },
  "patch_columns": {
    "id": [5, 6],
    "my-bool": [true, false]
  },
  "deletes": [7, 8],
  "distance_metric": "cosine_distance"
 }'

# Response payload
# {
#   "status": "OK"
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-upsert-columns-example-py')
# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
ns.write(
    upsert_columns={
        'id': [1, 2, 3, 4],
        'vector': [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
        'my-string': ['one', None, 'three', 'four'],
        'my-uint': [12, None, 84, 39],
        'my-bool': [True, None, False, True],
        'my-string-array': [['a', 'b'], ['b', 'd'], [], ['c']]
    },
    patch_columns={
        'id': [5, 6],
        'my-bool': [True, False],
    },
    deletes=[7, 8],
    distance_metric='cosine_distance'
)
```
```typescript
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`write-upsert-columns-example-ts`);

await ns.write({
  upsert_columns: {
    id: [1, 2, 3, 4],
    vector: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
    "my-string": ["one", null, "three", "four"],
    "my-uint": [12, null, 84, 39],
    "my-bool": [true, null, false, true],
    "my-string-array": [["a", "b"], ["b", "d"], [], ["c"]],
  },
  patch_columns: {
    id: [5, 6],
    "my-bool": [true, false],
  },
  deletes: [7, 8],
  distance_metric: "cosine_distance",
});
```
```go
package main

import (
	"context"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("write-upsert-columns-example-go")
	// If an error occurs, this call raises an error if a retry was not successful.
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertColumns: map[string][]any{
				"id":              {1, 2, 3, 4},
				"vector":          {[]float32{0.1, 0.1}, []float32{0.2, 0.2}, []float32{0.3, 0.3}, []float32{0.4, 0.4}},
				"my-string":       {"one", nil, "three", "four"},
				"my-uint":         {12, nil, 84, 39},
				"my-bool":         {true, nil, false, true},
				"my-string-array": {[]string{"a", "b"}, []string{"b", "d"}, []string{}, []string{"c"}},
			},
			PatchColumns: map[string][]any{
				"id":      {5, 6},
				"my-bool": {true, false},
			},
			Deletes:        []any{7, 8},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;
import java.util.stream.*;

public class WriteUpsertColumns {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-upsert-columns-example-java");
    // If an error occurs, this call raises a TurbopufferServiceException if a retry was not successful.
    ns.write(
      NamespaceWriteParams.builder()
        .upsertColumns(
          Columns.builder()
            .put("id", List.of(1, 2, 3, 4))
            .put(
              "vector",
              List.of(
                List.of(0.1f, 0.1f),
                List.of(0.2f, 0.2f),
                List.of(0.3f, 0.3f),
                List.of(0.4f, 0.4f)
              )
            )
            .put("my-string", List.of("one", Optional.empty(), "three", "four"))
            .put("my-uint", List.of(12, Optional.empty(), 84, 39))
            .put("my-bool", List.of(true, Optional.empty(), false, true))
            .put(
              "my-string-array",
              List.of(List.of("a", "b"), List.of("b", "d"), List.of(), List.of("c"))
            )
            .build()
        )
        .patchColumns(
          Columns.builder().put("id", List.of(5, 6)).put("my-bool", List.of(true, false)).build()
        )
        .deletes(List.of(7, 8))
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-upsert-columns-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));
// If an error occurs, this call raises a TurbopufferApiException if a retry was not successful.
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertColumns = new Columns()
            .SetColumn("id", new[] { 1, 2, 3, 4 })
            .SetColumn(
                "vector",
                new[]
                {
                    new[] { 0.1f, 0.1f },
                    new[] { 0.2f, 0.2f },
                    new[] { 0.3f, 0.3f },
                    new[] { 0.4f, 0.4f },
                }
            )
            // For columns that contain nulls, use a nullable element type
            // (null = no value).
            .SetColumn("my-string", new[] { "one", null, "three", "four" })
            .SetColumn("my-uint", new uint?[] { 12, null, 84, 39 })
            .SetColumn("my-bool", new bool?[] { true, null, false, true })
            .SetColumn(
                "my-string-array",
                new string[][]
                {
                    new string[] { "a", "b" },
                    new string[] { "b", "d" },
                    Array.Empty<string>(),
                    new string[] { "c" },
                }
            ),
        PatchColumns = new Columns()
            .SetColumn("id", new[] { 5, 6 })
            .SetColumn("my-bool", new[] { true, false }),
        Deletes = [7L, 8L],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-upsert-columns-example-rb")
# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
ns.write(
  upsert_columns: {
    id: [1, 2, 3, 4],
    vector: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
    'my-string': ["one", nil, "three", "four"],
    'my-uint': [12, nil, 84, 39],
    'my-bool': [true, nil, false, true],
    'my-string-array': [["a", "b"], ["b", "d"], [], ["c"]],
  },
  patch_columns: {
    id: [5, 6],
    'my-bool': [true, false],
  },
  deletes: [7, 8],
  distance_metric: "cosine_distance",
)
```
<!-- /multilang -->

### Conditional writes

To make writes conditional, use the `upsert_condition`, `patch_condition`, and
`delete_condition` parameters. These let you specify a condition that must be
satisfied for the write operation to each document to proceed.

Conditional deletes are distinct from [`delete_by_filter`](#delete-by-filter),
which should be used when the set of IDs to conditionally delete is not known
ahead of time.

Conditions are evaluated before each write, using the current value of the
document with the matching ID.

* If the document exists and the condition is met, the write is applied.
* If the document exists and the condition is not met, the write is skipped.
* If the document does not exist, the write is applied unconditionally for
  upserts and skipped unconditionally for patches and deletes.

The operation will return the actual number of documents written (upserted,
patched, or deleted).

Internally, the operation performs a query (one per batch) to determine which
documents match the condition, so it is billed as both a query and a write
operation. However, if the condition is not met for a given document, that write
is skipped and not billed.

The condition syntax matches the [`filters` parameter in the query
API](query#filtering), with an additional feature: you can reference the new value
being written using `$ref_new` references. These look like `{"$ref_new": "attr_123"}`
and can be used in place of value literals. This allows the condition to vary by
document in a multi-document write request.

Two common patterns:

* **Version checks**: Set `upsert_condition` to `["version", "Lt", {"$ref_new": "version"}]`
  to only apply writes when the new document has a higher version than the existing one.
* **Insert if not exists**: Set `upsert_condition` to `["id", "Eq", null]` to only
  insert documents that don't already exist. Since existing documents always have
  a non-null `id`, this condition fails for existing documents (skipping the write),
  while new documents are inserted unconditionally.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-conditional-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {
      "id": 101,
      "vector": [0.2, 0.8],
      "title": "LISP Guide for Beginners (draft_v2)",
      "version": 2
    },
    {
      "id": 102,
      "vector": [0.4, 0.4],
      "title": "AI for Practitioners (final)",
      "version": 5
    }
  ],
  "distance_metric": "cosine_distance"
}'

curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-conditional-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {
      "id": 101,
      "vector": [0.2, 0.8],
      "title": "LISP Guide for Beginners (final)",
      "version": 3
    },
    {
      "id": 102,
      "vector": [0.4, 0.4],
      "title": "AI for Practitioners (draft_v4)",
      "version": 4
    },
    {
      "id": 103,
      "vector": [0.6, 0.8],
      "title": "Database Internals (draft_v1)",
      "version": 1
    }
  ],
  "upsert_condition": ["version", "Lt", {"$ref_new": "version"}],
  "distance_metric": "cosine_distance"
}'

# Response payload
# {
#   "status": "OK",
#   "message": "documents committed successfully",
#   "rows_affected": 2
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-conditional-example-py')

ns.write(
    upsert_rows=[
        {
            'id': 101,
            'vector': [0.2, 0.8],
            'title': 'LISP Guide for Beginners (draft_v2)',
            'version': 2
        },
        {
            'id': 102,
            'vector': [0.4, 0.4],
            'title': 'AI for Practitioners (final)',
            'version': 5
        }
    ],
    distance_metric='cosine_distance'
)

# Conditionally upsert documents with news title, making sure no version
# regression occurs.
result = ns.write(
    upsert_rows=[
        {
            'id': 101,
            'vector': [0.2, 0.8],
            'title': 'LISP Guide for Beginners (final)',
            'version': 3
        },
        {
            'id': 102,
            'vector': [0.4, 0.4],
            'title': 'AI for Practitioners (draft_v4)',
            'version': 4
        },
        {
            'id': 103,
            'vector': [0.6, 0.8],
            'title': 'Database Internals (draft_v1)',
            'version': 1
        }
    ],
    upsert_condition=('version', 'Lt', {'$ref_new': 'version'}),
    distance_metric='cosine_distance'
)
print(result.rows_affected) # 2

results = ns.query(limit=10, include_attributes=True)
print(results.rows)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-conditional-example-ts`);

await ns.write({
  upsert_rows: [
    {
      id: 101,
      vector: [0.2, 0.8],
      title: "LISP Guide for Beginners (draft_v2)",
      version: 2,
    },
    {
      id: 102,
      vector: [0.4, 0.4],
      title: "AI for Practitioners (final)",
      version: 5,
    },
  ],
  distance_metric: "cosine_distance",
});

// Conditionally upsert documents with news title, making sure no version
// regression occurs.
const writeResult = await ns.write({
  upsert_rows: [
    {
      id: 101,
      vector: [0.2, 0.8],
      title: "LISP Guide for Beginners (final)",
      version: 3,
    },
    {
      id: 102,
      vector: [0.4, 0.4],
      title: "AI for Practitioners (draft_v4)",
      version: 4,
    },
    {
      id: 103,
      vector: [0.6, 0.8],
      title: "Database Internals (draft_v1)",
      version: 1,
    },
  ],
  upsert_condition: ["version", "Lt", { $ref_new: "version" }],
  distance_metric: "cosine_distance",
});
console.log(writeResult.rows_affected); // 2

const results = await ns.query({ rank_by: ["id", "asc"], limit: 10 });
console.log(results.rows!.length); // 3
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

	ns := tpuf.Namespace("write-conditional-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":      101,
					"vector":  []float32{0.2, 0.8},
					"title":   "LISP Guide for Beginners (draft_v2)",
					"version": 2,
				},
				{
					"id":      102,
					"vector":  []float32{0.4, 0.4},
					"title":   "AI for Practitioners (final)",
					"version": 5,
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}

	// Conditionally upsert documents with news title, making sure no version
	// regression occurs.
	res, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":      101,
					"vector":  []float32{0.2, 0.8},
					"title":   "LISP Guide for Beginners (final)",
					"version": 3,
				},
				{
					"id":      102,
					"vector":  []float32{0.4, 0.4},
					"title":   "AI for Practitioners (draft_v4)",
					"version": 4,
				},
				{
					"id":      103,
					"vector":  []float32{0.6, 0.8},
					"title":   "Database Internals (draft_v1)",
					"version": 1,
				},
			},
			UpsertCondition: turbopuffer.NewFilterLt("version", turbopuffer.NewExprRefNew("version")),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println("Rows affected:", res.RowsAffected) // 2

	results, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
		Limit: turbopuffer.LimitParam{
			Total: 1000,
		},
		IncludeAttributes: turbopuffer.IncludeAttributesParam{Bool: turbopuffer.Bool(true)},
	})
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(results.Rows))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class WriteConditional {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-conditional-example-java");

    ns.write(
      NamespaceWriteParams.builder()
        .upsertRows(
          List.of(
            Row.builder()
              .put("id", 101)
              .put("vector", List.of(0.2, 0.8))
              .put("title", "LISP Guide for Beginners (draft_v2)")
              .put("version", 2)
              .build(),
            Row.builder()
              .put("id", 102)
              .put("vector", List.of(0.4, 0.4))
              .put("title", "AI for Practitioners (final)")
              .put("version", 5)
              .build()
          )
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );

    // Conditionally upsert documents with news title, making sure no version
    // regression occurs.
    var writeResult = ns.write(
      NamespaceWriteParams.builder()
        .upsertRows(
          List.of(
            Row.builder()
              .put("id", 101)
              .put("vector", List.of(0.2, 0.8))
              .put("title", "LISP Guide for Beginners (final)")
              .put("version", 3)
              .build(),
            Row.builder()
              .put("id", 102)
              .put("vector", List.of(0.4, 0.4))
              .put("title", "AI for Practitioners (draft_v4)")
              .put("version", 4)
              .build(),
            Row.builder()
              .put("id", 103)
              .put("vector", List.of(0.6, 0.8))
              .put("title", "Database Internals (draft_v1)")
              .put("version", 1)
              .build()
          )
        )
        .upsertCondition(Filter.lt("version", Expr.refNew("version")))
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );
    System.out.println(writeResult.rowsAffected()); // 2

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .limit(10)
        .includeAttributes(true)
        .build()
    );
    System.out.println(queryResult.rows().get());
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

var ns = tpuf.Namespace("write-conditional-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 101)
                .Set("vector", new[] { 0.2f, 0.8f })
                .Set("title", "LISP Guide for Beginners (draft_v2)")
                .Set("version", 2),
            new Row()
                .Set("id", 102)
                .Set("vector", new[] { 0.4f, 0.4f })
                .Set("title", "AI for Practitioners (final)")
                .Set("version", 5),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);

// Conditionally upsert documents with news title, making sure no version
// regression occurs.
var writeResult = await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 101)
                .Set("vector", new[] { 0.2f, 0.8f })
                .Set("title", "LISP Guide for Beginners (final)")
                .Set("version", 3),
            new Row()
                .Set("id", 102)
                .Set("vector", new[] { 0.4f, 0.4f })
                .Set("title", "AI for Practitioners (draft_v4)")
                .Set("version", 4),
            new Row()
                .Set("id", 103)
                .Set("vector", new[] { 0.6f, 0.8f })
                .Set("title", "Database Internals (draft_v1)")
                .Set("version", 1),
        ],
        UpsertCondition = Filter.Lt("version", Expr.RefNew("version")),
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);
Console.WriteLine(writeResult.RowsAffected); // 2

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Limit = 10,
        IncludeAttributes = true,
    }
);
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine(row);
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-conditional-example-rb")

ns.write(
  upsert_rows: [
    {
      id: 101,
      vector: [0.2, 0.8],
      title: "LISP Guide for Beginners (draft_v2)",
      version: 2,
    },
    {
      id: 102,
      vector: [0.4, 0.4],
      title: "AI for Practitioners (final)",
      version: 5,
    },
  ],
  distance_metric: "cosine_distance",
)

# Conditionally upsert documents with news title, making sure no version
# regression occurs.
result = ns.write(
  upsert_rows: [
    {
      id: 101,
      vector: [0.2, 0.8],
      title: "LISP Guide for Beginners (final)",
      version: 3,
    },
    {
      id: 102,
      vector: [0.4, 0.4],
      title: "AI for Practitioners (draft_v4)",
      version: 4,
    },
    {
      id: 103,
      vector: [0.6, 0.8],
      title: "Database Internals (draft_v1)",
      version: 1,
    },
  ],
  upsert_condition: ["version", "Lt", { '$ref_new': "version" }],
  distance_metric: "cosine_distance",
)
puts result.rows_affected # 2

results = ns.query(limit: 10, include_attributes: true)
puts results.rows
```
<!-- /multilang -->

### Delete by filter

To delete documents that match a filter, use `delete_by_filter`. This operation will return
the actual number of documents removed.

Because the operation internally issues a query to determine which documents to
delete, this operation is billed as both a query and a write operation.

If `delete_by_filter` is used in the same request as other write operations,
`delete_by_filter` will be applied before the other operations. This allows you
to delete rows that match a filter before writing new row with overlapping IDs.
Note that patches to any deleted rows are ignored.

`delete_by_filter` has the same syntax as the [`filters` parameter in the query API](query#filtering).

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-delete-by-filter-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {"id": 101, "vector": [0.2, 0.8], "title": "LISP Guide for Beginners", "views": 10},
    {"id": 102, "vector": [0.4, 0.4], "title": "AI for Practitioners", "views": 2500}
  ],
  "distance_metric": "cosine_distance"
}'

curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-delete-by-filter-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "delete_by_filter": ["And", [
    ["title", "IGlob", "*guide*"],
    ["views", "Lte", 1000]
  ]]
}'

# Response payload
# {
#   "status": "OK",
#   "message": "documents committed successfully",
#   "rows_affected": 1 // number of rows that were deleted
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-delete-by-filter-example-py')

ns.write(
    upsert_rows=[
        {
            "id": 101,
            "vector": [0.2, 0.8],
            "title": "LISP Guide for Beginners",
            "views": 10,
        },
        {
            "id": 102,
            "vector": [0.4, 0.4],
            "title": "AI for Practitioners",
            "views": 2500,
        },
    ],
    distance_metric="cosine_distance",
)

# Delete posts with titles that include the word "guide"
# and have 1000 or less views
result = ns.write(
    delete_by_filter=("And", [("title", "IGlob", "*guide*"), ("views", "Lte", 1000)])
)
print(result.rows_affected)  # 1

results = ns.query(rank_by=("id", "asc"), limit=10)
print(len(results.rows))  # 1
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-delete-by-filter-example-ts`);

await ns.write({
  upsert_rows: [
    { id: 101, vector: [0.2, 0.8], title: "LISP Guide for Beginners", views: 10 },
    { id: 102, vector: [0.4, 0.4], title: "AI for Practitioners", views: 2500 },
  ],
  distance_metric: "cosine_distance",
});

// Delete posts with titles that include the word "guide"
// and have 1000 or less views
const writeResult = await ns.write({
  delete_by_filter: [
    "And",
    [
      ["title", "IGlob", "*guide*"],
      ["views", "Lte", 1000],
    ],
  ],
});
console.log(writeResult.rows_affected); // 1

const results = await ns.query({ rank_by: ["id", "asc"], limit: 10 });
console.log(results.rows!.length); // 1
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

	ns := tpuf.Namespace("write-delete-by-filter-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":     101,
					"vector": []float32{0.2, 0.8},
					"title":  "LISP Guide for Beginners",
					"views":  10,
				},
				{
					"id":     102,
					"vector": []float32{0.4, 0.4},
					"title":  "AI for Practitioners",
					"views":  2500,
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}

	// Delete posts with titles that include the word "guide"
	// and have 1000 or less views
	res, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			DeleteByFilter: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterIGlob("title", "*guide*"),
				turbopuffer.NewFilterLte("views", 1000),
			}),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println("Rows affected:", res.RowsAffected) // 1

	results, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
		Limit: turbopuffer.LimitParam{
			Total: 1000,
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(results.Rows)) // returns only one result
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class WriteDeleteByFilter {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-delete-by-filter-example-java");

    // Delete posts with titles that include the word "guide"
    // and have 1000 or less views
    var writeResult = ns.write(
      NamespaceWriteParams.builder()
        .deleteByFilter(Filter.and(Filter.iGlob("title", "*guide*"), Filter.lte("views", 1000)))
        .build()
    );
    System.out.println(writeResult.rowsAffected()); // 1

    var queryResult = ns.query(
      NamespaceQueryParams.builder().aggregateBy(Map.of("count", AggregateBy.count("id"))).build()
    );
    var aggregations = queryResult.aggregations().get();
    System.out.println(aggregations.get("count")); // 1
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-delete-by-filter-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Delete posts with titles that include the word "guide"
// and have 1000 or less views
var writeResult = await ns.Write(
    new NamespaceWriteParams
    {
        DeleteByFilter = Filter.And(Filter.IGlob("title", "*guide*"), Filter.Lte("views", 1000)),
    }
);
Console.WriteLine(writeResult.RowsAffected); // 1

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        AggregateBy = new Dictionary<string, AggregateBy>
        {
            ["count"] = AggregateBy.Count("id"),
        },
    }
);
var aggregations = queryResult.GetAggregations();
Console.WriteLine(aggregations["count"]); // 1
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-delete-by-filter-example-rb")

ns.write(
  upsert_rows: [
    { id: 101, vector: [0.2, 0.8], title: "LISP Guide for Beginners", views: 10 },
    { id: 102, vector: [0.4, 0.4], title: "AI for Practitioners", views: 2500 },
  ],
  distance_metric: "cosine_distance",
)

# Delete posts with titles that include the word "guide"
# and have 1000 or less views
result = ns.write(
  delete_by_filter: ["And", [
    ["title", "IGlob", "*guide*"],
    ["views", "Lte", 1000],
  ]],
)
puts result.rows_affected # 1

results = ns.query(rank_by: ["id", "asc"], limit: 10)
puts results.rows.length # 1
```
<!-- /multilang -->

### Patch by filter

To patch a dynamically determined set of documents, use `patch_by_filter`. This operation will return the actual number of documents updated. When [`rows_remaining`](#responsefield-rows_remaining) is set to true in the response, there may be more documents matching your filter that can be patched, issue a follow up request to patch those documents.

Because this operation uses a query to determine which rows need to be patched, it will be billed as a query & a patch operation (1 write, 2 queries total).

If `patch_by_filter` is used in the same request as other write operations, it is applied after `delete_by_filter` but before any other write operations. `patch_by_filter` will not apply to any rows which were deleted.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-patch-by-filter-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    {"id": 101, "vector": [0.2, 0.8], "title": "LISP Guide for Beginners", "views": 10, "status": "published"},
    {"id": 102, "vector": [0.4, 0.4], "title": "AI for Practitioners", "views": 2500, "status": "published"},
    {"id": 103, "vector": [0.6, 0.3], "title": "Rust Basics", "views": 50, "status": "published"}
  ],
  "distance_metric": "cosine_distance"
}'

curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/write-patch-by-filter-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "patch_by_filter": {
    "filters": ["And", [
      ["status", "Eq", "published"],
      ["views", "Lte", 100]
    ]],
    "patch": {"status": "archived"}
  }
}'

# Response payload
# {
#   "status": "OK",
#   "message": "documents committed successfully",
#   "rows_affected": 2 // number of rows that were patched
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'write-patch-by-filter-example-py')

ns.write(
    upsert_rows=[
        {
            "id": 101,
            "vector": [0.2, 0.8],
            "title": "LISP Guide for Beginners",
            "views": 10,
            "status": "published",
        },
        {
            "id": 102,
            "vector": [0.4, 0.4],
            "title": "AI for Practitioners",
            "views": 2500,
            "status": "published",
        },
        {
            "id": 103,
            "vector": [0.6, 0.3],
            "title": "Rust Basics",
            "views": 50,
            "status": "published",
        },
    ],
    distance_metric="cosine_distance",
)

# Archive posts that are published and have 100 or fewer views
result = ns.write(
    patch_by_filter={
        "filters": ("And", [("status", "Eq", "published"), ("views", "Lte", 100)]),
        "patch": {"status": "archived"},
    }
)
print(result.rows_affected)  # 2

results = ns.query(rank_by=("id", "asc"), include_attributes=["status"], limit=10)
for row in results.rows:
    print(f"ID {row['id']}: {row['status']}")  # IDs 101 and 103 are now archived
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`write-patch-by-filter-example-ts`);

await ns.write({
  upsert_rows: [
    { id: 101, vector: [0.2, 0.8], title: "LISP Guide for Beginners", views: 10, status: "published" },
    { id: 102, vector: [0.4, 0.4], title: "AI for Practitioners", views: 2500, status: "published" },
    { id: 103, vector: [0.6, 0.3], title: "Rust Basics", views: 50, status: "published" },
  ],
  distance_metric: "cosine_distance",
});

// Archive posts that are published and have 100 or fewer views
const writeResult = await ns.write({
  patch_by_filter: {
    filters: [
      "And",
      [
        ["status", "Eq", "published"],
        ["views", "Lte", 100],
      ],
    ],
    patch: { status: "archived" },
  },
});
console.log(writeResult.rows_affected); // 2

const results = await ns.query({ rank_by: ["id", "asc"], limit: 10, include_attributes: ["status"] });
results.rows!.forEach((row) => {
  console.log(`ID ${row.id}: ${row.status}`); // IDs 101 and 103 are now archived
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
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("write-patch-by-filter-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":     101,
					"vector": []float32{0.2, 0.8},
					"title":  "LISP Guide for Beginners",
					"views":  10,
					"status": "published",
				},
				{
					"id":     102,
					"vector": []float32{0.4, 0.4},
					"title":  "AI for Practitioners",
					"views":  2500,
					"status": "published",
				},
				{
					"id":     103,
					"vector": []float32{0.6, 0.3},
					"title":  "Rust Basics",
					"views":  50,
					"status": "published",
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}

	// Archive posts that are published and have 100 or fewer views
	res, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			PatchByFilter: turbopuffer.NamespaceWriteParamsPatchByFilter{
				Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
					turbopuffer.NewFilterEq("status", "published"),
					turbopuffer.NewFilterLte("views", 100),
				}),
				Patch: turbopuffer.RowParam{
					"status": "archived",
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println("Rows affected:", res.RowsAffected) // 2

	results, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
		Limit: turbopuffer.LimitParam{
			Total: 10,
		},
		IncludeAttributes: turbopuffer.IncludeAttributesParam{StringArray: []string{"status"}},
	})
	if err != nil {
		panic(err)
	}
	for _, row := range results.Rows {
		fmt.Printf("ID %v: %v\n", row["id"], row["status"]) // IDs 101 and 103 are now archived
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class WritePatchByFilter {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("write-patch-by-filter-example-java");

    // Archive posts that are published and have 100 or fewer views
    var writeResult = ns.write(
      NamespaceWriteParams.builder()
        .patchByFilter(
          NamespaceWriteParams.PatchByFilter.builder()
            .filters(Filter.and(Filter.eq("status", "published"), Filter.lte("views", 100)))
            .patch(
              NamespaceWriteParams.PatchByFilter.Patch.builder()
                .putAdditionalProperty("status", JsonString.of("archived"))
                .build()
            )
            .build()
        )
        .build()
    );
    System.out.println(writeResult.rowsAffected()); // 2

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .limit(10)
        .includeAttributes("status")
        .build()
    );
    for (var row : queryResult.rows().get()) {
      System.out.println("ID " + row.get("id") + ": " + row.get("status")); // IDs 101 and 103 are now archived
    }
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("write-patch-by-filter-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Archive posts that are published and have 100 or fewer views
var writeResult = await ns.Write(
    new NamespaceWriteParams
    {
        PatchByFilter = new PatchByFilter
        {
            Filters = Filter.And(Filter.Eq("status", "published"), Filter.Lte("views", 100)),
            Patch = new Row().Set("status", "archived"),
        },
    }
);
Console.WriteLine(writeResult.RowsAffected); // 2

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Limit = 10,
        IncludeAttributes = new List<string> { "status" },
    }
);
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine($"ID {row.Get<long>("id")}: {row.Get<string>("status")}"); // IDs 101 and 103 are now archived
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("write-patch-by-filter-example-rb")

ns.write(
  upsert_rows: [
    { id: 101, vector: [0.2, 0.8], title: "LISP Guide for Beginners", views: 10, status: "published" },
    { id: 102, vector: [0.4, 0.4], title: "AI for Practitioners", views: 2500, status: "published" },
    { id: 103, vector: [0.6, 0.3], title: "Rust Basics", views: 50, status: "published" },
  ],
  distance_metric: "cosine_distance",
)

# Archive posts that are published and have 100 or fewer views
result = ns.write(
  patch_by_filter: {
    filters: ["And", [
      ["status", "Eq", "published"],
      ["views", "Lte", 100],
    ]],
    patch: { status: "archived" },
  },
)
puts result.rows_affected # 2

results = ns.query(rank_by: ["id", "asc"], limit: 10, include_attributes: ["status"])
results.rows.each do |row|
  puts "ID #{row[:id]}: #{row[:status]}" # IDs 101 and 103 are now archived
end
```
<!-- /multilang -->
