---
title: "Control Plane"
description: "turbopuffer BYOC includes our control plane agent which we can use to apply adjustments to your cluster. You may also choose to manually approve certa"
group: "Reference"
---

turbopuffer BYOC includes our control plane agent which we can use to apply adjustments to your cluster.
You may also choose to [manually approve](#configuring-manual-approval-for-your-cluster) certain operations, though doing so will limit our team's ability to manage your cluster and respond to incidents.
See [our documentation](/docs/byoc/#control-plane) on the operational model of our control plane agent.

## Currently supported operations

The control plane agent is source-available upon request, and supports a limited amount of hardcoded operations to operate your cluster.
The currently supported operations are listed below:

- **Restart pods:** Allows us to rapidly restart and pods we see behaving problematically via telemetrics.
- **Scale Pods:** Allows us to change the desired replica count for your index and query nodes.
- **Trigger reindex:** Allows us to force a reindex of a namespace.
- **Trigger compaction:** Triggers a compaction of the LSM for a given namespace, which can improve query performance.
- **Trigger gc:** Trigger a manual run of our garbage collector, which will reduce object storage usage.
- **Upgrade tpuf:** Updates the image digest for your turbopuffer deployment triggering a rollout for the new version of turbopuffer.

We typically find our BYOC customers operate best allowing us to perform routine maintenance operations (restarting pods, triggering indexing/compaction/gc).
These operations may need to be performed unpredictably to react to shifting workloads or recent upgrades to your turbopuffer deployment.

## Configuring manual approval for your cluster

By default all control plane operations are automatically approved, but if you would like to make one or more operations require manual approval, you can edit the `tpuf-ctl-cluster-controller-config-*` ConfigMap found in the `tpuf-ctl-cluster` namespace of your cluster.
This ConfigMap defines a `controller_config.yaml` file with the following syntax:

```
apiVersion: v1
data:
  controller_config.yaml: |-
    vendor_url: https://tpuf-ctl-vendor.vercel.app/heartbeat/gcp-us-central1
    approvals:
      upgrade: auto  # can set to `manual`, but weakly discouraged

      restart: auto  # can set to `manual`, but strongly discouraged
      scale:   auto  # can set to `manual`, but strongly discouraged
      reindex: auto  # can set to `manual`, but strongly discouraged
      compact: auto  # can set to `manual`, but strongly discouraged
      gc:      auto  # can set to `manual`, but strongly discouraged
kind: ConfigMap
```

## Configuring external execution for upgrades

For customers managing their Helm deployments through external tooling (e.g., ArgoCD, Terraform, or other GitOps/CI tools), the standard upgrade flow can conflict with your deployment process. By default, our Helm chart uses [the `lookup` function](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/#using-the-lookup-function) to retain the current version across deployments. However, when your tooling doesn't support Helm lookups, any upgrades we perform through the control plane may be overwritten when your tooling re-applies the Helm chart.

To solve this, you can configure `external_execution` mode for upgrades. In this mode, the turbopuffer control plane will not perform upgrades directly. Instead, when a new version is available, you'll receive an automated notification to your Slack channel with the version to deploy. You can then update the `turbopuffer.initial_tag` value in your Helm values and apply it through your deployment pipeline.

To enable external execution for upgrades, you can set the following in your Helm `values.yaml`:

```yaml
control_plane:
  additional_config:
    approvals:
      upgrade: external_execution

turbopuffer:
  image:
    initial_tag: <commit-sha>
    force_initial_tag: true
```

### Retrieving the target version programmatically

If you want to automate this process, we expose the target version via an API endpoint that you can query from your deployment tooling:

```bash
curl -H "Authorization: Bearer <API_KEY>" \
     -H "Accept: application/json" \
     "https://control.turbopuffer.com/api/clusters/<cluster-id>/target_version"
```

Replace `<API_KEY>` with your cluster's API key and `<cluster-id>` with your cluster identifier.

The response includes both the git commit SHA and the image digest:

```json
{
  "target_version": "<commit-sha>",
  "target_digest": "sha256:<digest>"
}
```

You can use this endpoint in your Terraform configurations, CI/CD pipelines, or any other automation to retrieve and apply the latest target version.

#### Terraform example

```hcl
data "http" "turbopuffer_target_version" {
  url = "https://control.turbopuffer.com/api/clusters/${var.cluster_id}/target_version"

  request_headers = {
    Accept        = "application/json"
    Authorization = "Bearer ${var.turbopuffer_api_key}"
  }
}

locals {
  turbopuffer_version = jsondecode(data.http.turbopuffer_target_version.response_body)
}

# Use in your Helm release configuration:
#   local.turbopuffer_version.target_version  -> git commit SHA
#   local.turbopuffer_version.target_digest   -> image digest (sha256:...)
```

## Viewing proposed operations in your cluster

When turbopuffer proposes a modification to your cluster, the agent will create an associated Kubernetes resource for this operation:

```
$ kubectl get turbopufferoperations -n turbopuffer --sort-by=.metadata.creationTimestamp
NAME               APPROVED   STATE               AGE     DETAILS
qjh4uts8557qxly3   true       SUCCESS             7m58s   Upgrade to 46bea73f769ed2e4...
jsilyy4wu8skamb9   true       SUCCESS             7m57s   Upgrade to c7ce48b6be870806...
kqc3ltskmsx32nr7   true       SUCCESS             7m46s   Upgrade to 60b44ccd78eaf20c...
pnblpzmh5gp5fwsy   true       SUCCESS             7m46s   Upgrade to 32c171415362b200...
0a8n5w41jyj8i35v   false      REQUIRES_APPROVAL   7m46s   Restart pods: turbopuffer-query-0*
```

You can approve an operation by editing the Kubernetes configuration, for example, we approve `0a8n5w41jyj8i35v` by running:

```
kubectl patch turbopufferoperation -n turbopuffer 0a8n5w41jyj8i35v --type=merge -p '{"spec": {"approved": true}}'
```

Custom Resource Definition transitions are generally logged by your cloud provider's Kubernetes cluster, so your standard audit logging tools should support turbopuffer's operations.
