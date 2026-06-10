---
id: "digest-creation#verify-review-commit"
title: "Digest creation"
heading: "Verify, review, commit"
group: "Overview"
order: 74
url: "/docs/digest-creation#verify-review-commit"
anchor: "verify-review-commit"
terms: ["verify","review","commit","command","gate","builds","site","fails","section","anchor","missing","rendered","html","warns","coverage","fidelity","drift","markdown","tree","makes","prose","facts","reviewable","diff","stale","digest","triggers","line","runtime","warning","keeps","serving","until","rebuilt","pnpm","exec","checks","every","resolves","because"]
hash: "3e04fbcdb9c42dcd79f213c0ffc5ff67e8eba56d67c1e18de255ae88432e8c8a"
mode: "agent-primary"
facts: [{"kind":"code","literal":"pnpm exec ask digest verify     # builds the site, checks every anchor resolves\ngit add .hev-ask","chunkId":"digest-creation#verify-review-commit"},{"kind":"code","literal":"ask digest verify","chunkId":"digest-creation#verify-review-commit"}]
sources: [{"chunkId":"digest-creation#verify-review-commit","url":"/docs/digest-creation#verify-review-commit","anchor":"verify-review-commit"}]
---

The verify command is the CI gate: it builds the site, fails when any section anchor is missing from the rendered HTML, and warns on coverage or fidelity drift. The markdown tree makes each section's prose and facts one reviewable diff; a stale digest triggers a one-line runtime warning but keeps serving until rebuilt.
