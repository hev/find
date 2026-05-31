---
title: "Common Operations"
description: "While turbopuffer strives to be as low interaction as possible, there are certain manual operations you will have to perform in your BYOC deployment."
group: "Reference"
---

While turbopuffer strives to be as low interaction as possible, there are certain manual operations you will have to perform in your BYOC deployment.

## Securely partitioning your data

turbopuffer BYOC allows you to configure multiple organizations, each with their own set of API keys which you can use to scope data access.
Currently, we only support creating admin API keys, that will apply to all namespaces in their organization.
For this reason, if you need to ensure data is isolated we recommend creating multiple organizations instead.
If this is a limitation, we recommend you contact us on Slack.

### Generating org IDs and API keys

You can generate valid org IDs and API keys using any tooling that produces cryptographically random values. The format requirements are:

**Org ID**
- 24 character random string
- Alphabet: `[a-z0-9]` (lowercase alphanumeric only)

**API Key**
- Prefix: `tpuf_`
- Followed by: 32 character random string from alphabet `[a-zA-Z0-9]`
- Full format: `tpuf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**Stored API Key Hash**
- Format: `base64(sha256(full_api_key))`
- The hash is computed over the complete API key including the `tpuf_` prefix

Your BYOC kit includes a `generate_secrets.py` script that generates these values for you.

### Storing org configuration

```yaml
authentication:
  allowed_api_keys_sha256:
    "your24charorgidhere1234":
      - "YourBase64EncodedSHA256HashHere+40CharactersTotal="
      - "AnotherBase64EncodedSHA256HashHere+40CharactersTot="
```

### Adding additional organizations

To add more organizations, generate new org ID and API key pairs and add them to the configuration:

```yaml
authentication:
  allowed_api_keys_sha256:
    "existingorgid123456789012":
      - "ExistingOrgKeyHash..."
      - "AnotherExistingOrgKeyHash..."
    "neworgid0987654321abcdef":
      - "NewOrgKeyHash..."
      - "AnotherNewOrgKeyHash..."
```

### Adding a new API key to an existing organization

Each organization can have multiple API keys for key rotation, different services, or other access patterns. To add a new API key, use the `api_key.py` script from your BYOC kit and append the generated hash to the organization's key list:

```yaml
authentication:
  allowed_api_keys_sha256:
    "existingorgid123456789012":
      - "ExistingOrgKeyHash..."
      - "NewlyAddedKeyHash..."
```

### Applying configuration changes

After updating the configuration, apply the changes using the [helm upgrade command](/docs/byoc/configuration).
