---
id: "tradeoffs#cost-and-latency-of-agentic-search"
title: "Tradeoffs"
heading: "Cost and latency of agentic search"
group: "Overview"
order: 102
url: "/docs/tradeoffs#cost-and-latency-of-agentic-search"
anchor: "cost-and-latency-of-agentic-search"
terms: ["cost","latency","agentic","search","path","costs","real","small","money","worst","case","seconds","bounded","haiku","round","trips","submitted","query","domain","context","prompt","cached","across","rounds","offline","build","uses","opus","hash","gate","means","paying","only","content","changes","keyword","first","class","mode","anyone"]
hash: "64c96faf9220cd1746ff5fe83b61b585b03f23674074ae444bfec6a16b4411de"
mode: "agent-primary"
facts: [{"kind":"code","literal":"maxIterations","chunkId":"tradeoffs#cost-and-latency-of-agentic-search"}]
sources: [{"chunkId":"tradeoffs#cost-and-latency-of-agentic-search","url":"/docs/tradeoffs#cost-and-latency-of-agentic-search","anchor":"cost-and-latency-of-agentic-search"}]
---

The agentic path costs real if small money and latency: worst case a few seconds of bounded Haiku round-trips per submitted query, with domain context prompt-cached across rounds; the offline build uses Opus but the hash gate means paying only when content changes. Keyword-only is a first-class mode for anyone who doesn't want a key in the loop.
