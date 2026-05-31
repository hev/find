---
title: "Enterprise"
description: "Enterprise"
group: "Operations"
---

```
           ╔═══(0): Multitenancy (default)═════════════════╗
           ║┏━tpuf's cloud━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║░
           ║┃ ┌──────────────┐           ┌──────────────┐┃ ║░
           ║┃ │    shared    │           │    shared    │┃ ║░
 ─nw fees──╬╋▶│   compute    │──────────▶│    bucket    │┃ ║░
           ║┃ └──────────────┘           └──────────────┘┃ ║░
           ║┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
           ╚═══════════════════════════════════════════════╝░
            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

```
           ╔═══(1): Bring Your Own Bucket (BYOB)═══════════╗
           ║┏━tpuf's cloud━━━━┓        ┏━your cloud━━━━━┓ ║░
           ║┃ ┌──────────────┐ ┃        ┃                ┃ ║░
           ║┃ │    shared    │ ┃        ┃┌──────────────┐┃ ║░
──nw fees──╬╋▶│   compute    │◀╋────────▶│    bucket    │┃ ║░
           ║┃ └──────────────┘ ┃        ┃└──────────────┘┃ ║░
           ║┗━━━━━━━━━━━━━━━━━━┛        ┗━━━━━━━━━━━━━━━━┛ ║░
           ╚═══════════════════════════════════════════════╝░
            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

```
           ╔═══(2): Single-Tenancy Hosted══════════════════╗
           ║┏━tpuf's cloud━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║░
           ║┃ ┌──────────────┐           ┌──────────────┐┃ ║░
           ║┃ │   isolated   │           │   isolated   │┃ ║░
───nw fees─╬╋─▶   compute    │──────────▶│    bucket    │┃ ║░
           ║┃ └──────────────┘           └──────────────┘┃ ║░
           ║┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
           ╚═══════════════════════════════════════════════╝░
            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

```
           ╔═══(3): Bring Your Own Cloud (BYOC)══════════════════════╗
           ║┏━tpuf's cloud━┓  ┏━your cloud (we are oncall)━━━━━━━━━━┓║░
           ║┃              ┃  ┃                                     ┃║░
           ║┃┌────────────┐┃  ┃ ┌──────────────┐    ┌──────────────┐┃║░
           ║┃│ telemetry  │◀──╋─│   compute    │───▶│    bucket    │┃║░
           ║┃└────────────┘┃  ┃ └──────────────┘    └──────────────┘┃║░
           ║┗━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║░
           ╚═════════════════════════════════════════════════════════╝░
            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## PoC Process

1. **Suitability.** You will meet with the team to discuss your use case and
   determine if it is a good fit for the PoC. We will review the [Limits
together.](https://turbopuffer.com/docs/limits) If there's a good fit, we will
do a follow-up kick-off meeting.
2. **Pricing.** If it is a good match and you want to move forward with a PoC,
   we will send you a ballpark quote estimate that we will update further as we
have data from the PoC.
3. **PoC Kick-off.** We will meet with you to discuss the details of the PoC,
   including the following:
1. What is the scope of the PoC?
2. What metrics are required to hit?
3. Timeline for the PoC
4. Can we do the PoC without extensive security review, e.g. with scrubbed data?
     Otherwise, we will need to do a security review and legal review.
4. **Weekly PoC Meetings.** We will meet with you weekly to discuss progress of
   the PoC.
5. **Procurement.** We send you an MSA, DPA, and final order form to sign.
6. **Launch.** We're in production!
