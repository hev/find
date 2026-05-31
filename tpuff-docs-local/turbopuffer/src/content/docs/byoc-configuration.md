---
title: "Configuration"
description: "turbopuffer is configurable by modifying a Kubernetes ConfigMap in the turbopuffer namespace of your deployment. The turbopuffer team works with you t"
group: "Reference"
---

turbopuffer is configurable by modifying a Kubernetes ConfigMap in the `turbopuffer` namespace of your deployment. The turbopuffer team works with you to manage your deployment, e.g. propose ConfigMap changes to your cluster, e.g. tuning cache sizes, LSM settings, or recall.

To update the ConfigMap, you can use the Helm chart with the
`values.yaml` you maintain for the cluster:

Change `values.yaml` in the `byoc-kit` directory and run the following:

#### GCP

```bash
helm upgrade -n default turbopuffer \
  oci://us-central1-docker.pkg.dev/turbopuffer-onprem/charts/tpuf \
  --values=values.yaml \
  --values=values.secret.yaml \
  --values=metrics-keys.yaml
```

You may need to log in to the helm registry first:
```bash
helm registry login us-central1-docker.pkg.dev
```
#### AWS

```bash
helm upgrade -n default turbopuffer \
  oci://961341552108.dkr.ecr.us-west-2.amazonaws.com/turbopuffer/turbopuffer/charts/tpuf \
  --values=values.yaml \
  --values=values.secret.yaml \
  --values=metrics-keys.yaml
```

You may need to log in first:
```bash
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin 961341552108.dkr.ecr.us-west-2.amazonaws.com
```
#### Azure

```bash
helm upgrade -n default turbopuffer \
  oci://turbopuffer.azurecr.io/turbopuffer/charts/tpuf \
  --values=values.yaml \
  --values=values.secret.yaml \
  --values=metrics-keys.yaml
```

You may need to log in first:
```bash
az login --tenant 398cc17e-41b3-44de-929a-dc4048da9592
az acr login --name turbopuffer
```

## cloud specific configurations

The following configuration settings are under `kubernetes`:

#### AWS

**kubernetes.ec2_preferred_zone** object

The preferred availability zone to be used for query and index nodes.

**Note**: Setting this to multiple availability zones will incur an additional networking charge from AWS.
```yaml
kubernetes:
  ec2_preferred_zone:
    query: "us-west-2a"
    index: "us-west-2a"
```

---

**kubernetes.ec2_instance_tags** object

Tags to be added to the EC2 instances in the cluster.

```yaml
kubernetes:
  ec2_instance_tags:
    my-tag: my-value
```

---

**kubernetes.nodepool_labels** object

Additional labels to be applied to the node pools.

```yaml
kubernetes:
  nodepool_labels:
    yourcorp-billing-code: xyz
```
#### Azure

**kubernetes.azure_preferred_zone** object

The preferred availability zone to be used for query and index nodes.

```yaml
kubernetes:
  azure_preferred_zone:
    query: "1"
    index: "1"
```

---

**kubernetes.nodepool_labels** object

Additional labels to be applied to the node pools.

```yaml
kubernetes:
  nodepool_labels:
    yourcorp-billing-code: xyz
```
#### GCP

**kubernetes.preferred_zone** object

The preferred availability zone to be used for query and index nodes.

```yaml
kubernetes:
  preferred_zone:
    query: "us-central1-a"
    index: "us-central1-a"
```

---

**kubernetes.nodepool_labels** object

Additional labels to be applied to the node pools.

```yaml
kubernetes:
  nodepool_labels:
    yourcorp-billing-code: xyz
```

The following are configurations settings under `ingress`:

**internal** boolean

If true, the turbopuffer ingress will be exposed on an internal IP.

```yaml
ingress:
  internal: false
```

---

**ingress.certificates.mode** string

Configures how certificates will be handled in the cluster.

  * `manual` - if using, you must also set `manual.secretName:` to the name of the secret containing the TLS cert
  * `disabled` - needed if using Google Managed Certificates or if you wish to not use TLS
  * `letsencrypt`
  * `aws` - use an AWS managed certificate. You must also set `aws.certificate_arn:`

```yaml
ingress:
  certificates:
    mode: 'letsencrypt'
```

---

**ingress.read_replicas** object

Configures additional query replicas for specific (org, namespace) pairs. By default a namespace is served by a single query replica. Configuring read replicas spreads query load across more nodes, which is useful for read-heavy or high-QPS namespaces.

The `namespace` field supports glob wildcards (`*`, `?`). The first matching entry wins if multiple patterns match the same namespace.

```yaml
tpuf_config:
  ingress:
    read_replicas:
      # Spread load for a high-QPS namespace across 4 replicas.
      - org_id: "5x8olkguh1l2jvtjrpgnvlcm"
        namespace: "high-qps-namespace"
        count: 4
      # Glob patterns match many namespaces with a single entry.
      - org_id: "5x8olkguh1l2jvtjrpgnvlcm"
        namespace: "prod.shard-*"
        count: 2
```

## turbopuffer specific settings

**authentication.allowed_api_keys_sha256** object

A mapping of org ids to API keys. Each API key is expected by be a 44 character base 64 encoded SHA-256 key.

See [Org Configuration](/docs/byoc/operations#securely-partitioning-your-data) for details on generating org IDs and API keys.

**Note**: Currently all BYOC keys are generated as _admin_ keys for their organization.
To partition your data securely we recommend [creating multiple organizations](/docs/byoc/operations#adding-additional-organizations).
```yaml
tpuf_config:
  authentication:
    allowed_api_keys_sha256:
      "5x8olkguh1l2jvtjrpgnvlcm":  # Org ID (24 chars, lowercase alphanumeric)
        - "IaG0JUcIiCXKwqhIWH8Qr0incF2xsbRZRRJJxznl0GM="  # base64(sha256("tpuf_..."))
```

---

**remote_settings_overrides** boolean

When `true`, the service loads an additional settings overlay from your blob bucket (S3/GCS) at the path **`system/settings/default.yaml`**.
This lets you change settings (e.g. add orgs or API keys) by updating that file in object storage without redeploying the ConfigMap.
The file is re-fetched on an interval controlled by **`dynamic_poll_remote_ms`** (milliseconds). Only settings that are "dynamic"
(e.g. `authentication.allowed_api_keys_sha256`) are applied on each reload without a restart.

```yaml
tpuf_config:
  remote_settings_overrides: true
  dynamic_poll_remote_ms: 300000  # optional; re-fetch remote overlay every 5 minutes
```

---

**fairness.query_concurrency_per_namespace** number

Maximum concurrent queries to a single namespace allowed. This protects the node
against a single namespace being overloaded. 429s will be returned from
queries if there is not enough capacity to handle them.

```yaml
tpuf_config:
  fairness:
    query_concurrency_per_namespace: 16  # default
```

---

**fairness.query_bulkhead_wait_ms** number

Maximum milliseconds to wait if the query concurrency limit is reached.

```yaml
tpuf_config:
  fairness:
    query_bulkhead_wait_ms: 800  # default
```

---

**search.max_topk** number

Maximum number of documents that can be requested in a single query via the `limit.total` parameter.

```yaml
tpuf_config:
  search:
    max_topk: 10000  # default
```

---

**cache.prewarm.keep_warm_orgs** object

A set of org_ids to keep warm in cache. On node startup, machines will prewarm
namespaces for these orgs to ensure their cache is hot.

Not recommended for most users.

```yaml
tpuf_config:
  cache:
    prewarm:
      keep_warm_orgs:
        - '<premium-users-org>'
        - '<no-cold-starts-pls-org>'
```

---

**cache.disk_budget_bytes** number

The absolute number of bytes or percentage of local SSD capacity to use as a cache.

Not recommended changing for most users.

```yaml
tpuf_config:
  cache:
    disk_budget_bytes: 0.95  # default, leaves headroom for the filesystem
```

---

**indexing.cache_fill_concurrency** number

Number of cache fills to allow concurrently in the background per node. These are fired
after a a cold query.

We prioritize cache fills for more important files (i.e. to get faster queries
sooner), e.g. centroids.

```yaml
tpuf_config:
  indexing:
    cache_fill_concurrency: 2  # default
```

---

**indexing.reindex_unindexed_bytes_max** number

The maximum number of unindexed bytes allowed in the WAL before a reindex is triggered.

```yaml
tpuf_config:
  indexing:
    reindex_unindexed_bytes_max: 64000000  # default
```

---

**indexing.reindex_unindexed_rows_max** number

The maximum number of rows we'll allow to remain unindexed. If the
namespace has at least this many unindexed rows, a /index call will
always trigger an index operation.

```yaml
tpuf_config:
  indexing:
    reindex_unindexed_rows_max: 50000  # default
```

---

**indexing.reindex_unindexed_wal_entries** number

The maximum number of unindexed WAL entries allowed before a reindex is triggered.

```yaml
tpuf_config:
  indexing:
    reindex_unindexed_wal_entries: 512  # default
```

---

**indexing.batch_size_bytes** number

During indexing, the number of document bytes to process at a given time before
flushing. An indexing run can be composed of multiple batches, where we
flush our progress incrementally after each bach.

```yaml
tpuf_config:
  indexing:
    batch_size_bytes: 1250000000  # 1.25 GB, default
```

---

**tracing.otlp_endpoint** string

The OTLP endpoint to emit traces to, if any. Should end with `/v1/traces`. If empty, traces
won't be emitted.

```yaml
tpuf_config:
  tracing:
    otlp_endpoint: "http://localhost:4318/v1/traces"
```

---

**stats_export** object

A statsd endpoint to emit metrics to.

If present, all three subfields are required.

```yaml
tpuf_config:
  stats_export:
    prefix: "foocorp.turbopuffer"  # do not include trailing dot
    host: "foocorp-statsd"
    port: 8125
```

---

**blob.max_concurrent_requests** number

The maximum number of concurrent requests in flight to object storage at one given time.

```yaml
tpuf_config:
  blob:
    max_concurrent_requests: 4000  # default
```

---

**storage.lsm_ttl_seconds** number

The amount of time data can live in the LSM tree before being force-compacted.

This setting serves two purposes:
- Compaction speeds up queries. By compacting more frequently, queries will be more efficient.
- For compliance, i.e. if a customer requires that deletes (via the API) are properly deleted within
  X days, setting this to a value < X days will ensure that the index doesn't still contain any residual
  data from the deleted documents.

```yaml
tpuf_config:
  storage:
    lsm_ttl_seconds: 1728000  # 20 days, default
```
