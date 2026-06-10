---
id: "api/endpoint#suggested-questions-get"
title: "Search endpoint"
heading: "Suggested questions (GET)"
group: "API"
order: 33
url: "/docs/api/endpoint#suggested-questions-get"
anchor: "suggested-questions-get"
terms: ["suggested","questions","base","route","returns","digest","baked","loop","model","call","overlay","fetches","once","first","open","empty","list","simply","renders","nothing","suggestions","does","stay","fresh","claude","haiku","query","populate","array","without","just","means","shows","none"]
hash: "09b11b93e36f83adbf3806b64893ae0d6e67036b50132a6ffb096ad9e279489b"
mode: "source-primary"
facts: [{"kind":"code","literal":"{\n  \"suggestions\": [\"How does the digest stay fresh?\"],\n  \"model\": \"claude-haiku-4-5\"\n}","chunkId":"api/endpoint#suggested-questions-get"},{"kind":"code","literal":"GET /api/ask","chunkId":"api/endpoint#suggested-questions-get"},{"kind":"code","literal":"suggestions","chunkId":"api/endpoint#suggested-questions-get"}]
sources: [{"chunkId":"api/endpoint#suggested-questions-get","url":"/docs/api/endpoint#suggested-questions-get","anchor":"suggested-questions-get"}]
---

A GET on the base route returns the digest's baked-in suggested questions and the loop model with no model call; the overlay fetches it once on first open when AI is on, and an empty list simply renders nothing.
