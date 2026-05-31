---
title: "Audit Logs"
description: "turbopuffer provides audit logs for customers on Scale and Enterprise plans. Contact us to enable audit logs for your organization."
group: "Operations"
---

turbopuffer provides audit logs for customers on Scale and Enterprise plans.
[Contact us](/contact) to enable audit logs for your organization.

## Retention 

Audit logs have a 30-day retention period by default, which can be extended on request. 

## Log Streams

Audit log events can be streamed to an external destination. Supported destinations include SIEM providers (Datadog,
Splunk, Microsoft Sentinel), object storage (AWS S3, Google Cloud Storage), and custom HTTPS endpoints. Log streaming is available on [Scale and Enterprise](/pricing) plans and can be configured from the
customer settings page.

## Events

| Action | Actor | Target |
| --- | --- | --- |
| `invitation-created` | [User](#user) | [Invitation](#invitation) |
| `invitation-accepted` | [User](#user) | [Invitation](#invitation) |
| `invitation-revoked` | [User](#user) | [Invitation](#invitation) |
| `user-added` | [System](#system) | [User](#user) |
| `user-removed` | [User](#user) | [User](#user) |
| `api-key-created` | [User](#user) | [API Key](#api-key) |
| `api-key-marked-as-expired` | [User](#user) | [API Key](#api-key) |
| `session-created` | [User](#user) | [Session](#session) |
| `session-revoked` | [User](#user) | [Session](#session) |

### Examples

A user creates an API key:

```json
{
  "action": "api-key-created",
  "occurred_at": "2026-04-13T14:22:08Z",
  "actor": {
    "type": "user",
    "id": "V1StGXR8_Z5jdHi6B-myTq",
    "name": "ada@example.com"
  },
  "targets": [
    {
      "type": "api-key",
      "id": "8fW3zNcY6tRo1kGpLvAe2b/production",
      "name": "production",
      "metadata": { "suffix": "a1b2" }
    }
  ],
  "context": { "location": "203.0.113.42" },
  "metadata": {
    "session_id": "sess_lK9eT0vB3xYq2pNwA4fJ7"
  }
}
```

A user marks an API key as expired:

```json
{
  "action": "api-key-marked-as-expired",
  "occurred_at": "2026-04-13T14:25:11Z",
  "actor": {
    "type": "user",
    "id": "V1StGXR8_Z5jdHi6B-myTq",
    "name": "ada@example.com"
  },
  "targets": [
    {
      "type": "api-key",
      "id": "8fW3zNcY6tRo1kGpLvAe2b/production",
      "name": "production",
      "metadata": { "suffix": "a1b2" }
    }
  ],
  "context": { "location": "203.0.113.42" },
  "metadata": {
    "session_id": "sess_lK9eT0vB3xYq2pNwA4fJ7"
  }
}
```

## Schemas

Each audit log event includes the `action` that was taken, the time it `occurred_at`, the
`actor` who performed it, the `targets` that were affected, the client IP
in `context.location`, and optional `metadata` about the session.

```typescript
type AuditLogEvent = {
  action: string;
  occurred_at: string;             // ISO 8601 datetime
  actor: Actor;
  targets: Target[];
  context: {
    location: string;              // client IP address
  };
  metadata: {
    session_id?: string;
    impersonator?: string;         // email of turbopuffer admin acting on behalf of
                                   // the customer (requires customer authorization)
    impersonation_reason?: string;
  };
};

type Actor = User | System;

type Target = User | ApiKey | Invitation | Session;

```

### User

```typescript
type User = {
  type: "user";
  id: string;
  name: string;                    // email address
};
```

### API Key

```typescript
type ApiKey = {
  type: "api-key";
  id: string;
  name: string;                    // display name of the key
  metadata: {
    suffix: string;                // last 4 characters of the key
  };
};
```

### Invitation

```typescript
type Invitation = {
  type: "invitation";
  id: string;
  name: string;                    // email address of invited user
  metadata?: {
    invited_user_id: string;         
  };
};
```

### Session

```typescript
type Session = {
  type: "session";
  id: string;                        
  name: string;                    // session ID
  metadata: {
    user_agent: string;
    impersonator?: string;         // email of turbopuffer admin acting on behalf of
                                   // the customer (requires customer authorization)
    impersonation_reason?: string;
  };
};
```

### System

A special actor representing actions performed automatically rather than by a specific user.

```typescript
type System = {
  type: "system";
  id: "system";
  name: "System";
};
```
