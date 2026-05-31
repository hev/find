---
title: "Chunking"
description: "Chunking is context engineering for your embedding model. It is a critical, and often under-appreciated, component of your retrieval pipeline. Your ch"
group: "Guides"
---

Chunking is context engineering for your embedding model. It is a critical, and often under-appreciated, component of your retrieval pipeline. Your chunking strategy, good or bad, will set the ceiling for recall. This guide provides rules of thumb to tune your chunking strategy for the best possible recall.

## Not too long

Even if your embedding model technically allows up to 32k token inputs, you won't get the best results that way, for two reasons:

1. **Attention**: The model can only effectively attend to so many tokens at once. Quality degrades before you hit the model's enforced maximum input length.
2. **Compression**: You're asking the embedding model to compress many tokens into one embedding. The longer the chunk, the lossier the compression.

## Not too short

You need to provide enough context for the embedding model to understand the input as a standalone string.

Most embedding models cannot see the full document when producing an embedding ([exception below!](#use-a-contextual-embedding-model)). If your chunks are too small, most of them will reference concepts, people, places, and things described elsewhere in the document. For example, consider these two chunks from a single document:

```text
chunk 1:
Dory recently moved from The Great Barrier Reef to a new home in Sydney Harbor. 
Her new address is 42 Wallaby Way.

chunk 2:
She got a good deal from P. Sherman. 
He sold her the house for only $200,000.
```

For the query `How much was Dory's new house?`, neither chunk contains the necessary context to fully answer. The answer is contained in chunk 2, but chunk 2 lacks the context that "she" means Dory and "the house" means 42 Wallaby Way. If the two chunks were combined into a single chunk, all the necessary information would be contained (at the expense of compression loss).

## Respect obvious chunk boundaries

Some corpora have obvious chunking boundaries. Chunking code files, for example, should respect function boundaries. If you split a function definition down the middle, each chunk loses the information needed to interpret it correctly, so the embedding tends to represent a syntactically broken fragment rather than the semantics of the function. Regardless of whether you use a traditional or contextual embedding model, you should use tools like [tree-sitter](https://github.com/tree-sitter/tree-sitter) for code or markdown splitters to chunk documents with known boundaries.

## Start with ~300 token chunks with overlap

If you are using a traditional embedding model, we recommend starting at **~300 token chunks with two-sentence overlap between chunks** for text documents. This balances the tradeoff between good context and good compression. From that starting point, iteratively tweak your chunk length and overlap to achieve the desired results.

The Python code sample demonstrates using the `blingfire` sentence splitter to performantly split large documents (books) into chunks of configurable size and overlap.

<!-- multilang -->
```python
import requests
from livekit import blingfire
from tokenizers import Tokenizer

# TARGET_TOKENS is a soft floor: keep adding whole sentences until crossing it.
TARGET_TOKENS = 300
# SENTENCE_OVERLAP carries context from the end of one chunk into the next.
SENTENCE_OVERLAP = 2

# Use the same tokenizer as your embedding model so token counts match what
# the model sees. Caches tokenizer files (not weights) on first use.
TOKENIZER = Tokenizer.from_pretrained("Qwen/Qwen3-Embedding-4B")

# Pride and Prejudice, Moby-Dick.
GUTENBERG_BOOK_IDS = [1342, 2701]

def fetch_book(book_id: int) -> str:
    # Download the book text from Project Gutenberg
    url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text

def pack_sentences_into_chunks(text: str, spans: list[tuple[int, int]], token_counts: list[int]) -> list[str]:
    chunks: list[str] = []
    start = 0

    while start < len(spans):
        end = start + 1
        tokens = token_counts[start]
        # Keep at least SENTENCE_OVERLAP + 1 sentences per chunk so the next
        # chunk's start advances, then grow until we cross the token target.
        while end < len(spans) and (
            end - start <= SENTENCE_OVERLAP or tokens < TARGET_TOKENS
        ):
            tokens += token_counts[end]
            end += 1

        chunks.append(text[spans[start][0] : spans[end - 1][1]])

        if end == len(spans):
            break

        start = end - SENTENCE_OVERLAP

    return chunks

def chunk_documents(texts: list[str]) -> list[list[str]]:
    doc_spans: list[list[tuple[int, int]]] = []
    for text in texts:
        # BlingFire removes whitespace between sentences. Use offsets to build
        # chunks from the untouched original text.
        _, spans = blingfire.text_to_sentences_with_offsets(text)
        doc_spans.append(spans)

    # One encode_batch over all sentences is much faster than per-document calls.
    flat_sentences = [text[s:e] for text, spans in zip(texts, doc_spans) for s, e in spans]
    encoded = TOKENIZER.encode_batch(flat_sentences, add_special_tokens=False)
    flat_token_counts = [len(e.ids) for e in encoded]

    chunks_per_doc: list[list[str]] = []
    offset = 0
    for text, spans in zip(texts, doc_spans):
        sentence_count = len(spans)
        token_counts = flat_token_counts[offset : offset + sentence_count]
        chunks_per_doc.append(pack_sentences_into_chunks(text, spans, token_counts))
        offset += sentence_count

    assert offset == len(flat_token_counts)
    return chunks_per_doc

def chunk_corpus() -> list[list[str]]:
    texts = [fetch_book(book_id) for book_id in GUTENBERG_BOOK_IDS]
    return chunk_documents(texts)

if __name__ == "__main__":
    chunks_per_doc = chunk_corpus()
    chunk_count = sum(len(chunks) for chunks in chunks_per_doc)
    print(f"{chunk_count} chunks across {len(chunks_per_doc)} documents")
```
<!-- /multilang -->

## Use a contextual embedding model

Contextual embedding models such as `voyage-context-3` or `pplx-embed-context-v1-{0.6b, 4b}` provide a practical means of improving recall without significantly adding cost, latency, or complexity to your embedding pipeline.

With these models, you pass the full document to the model as a list of arbitrary-length text chunks. The model attends to the _entire_ document and produces contextualized embeddings for each chunk in one forward pass.

Consider again the example:

```text
chunk 1:
Dory recently moved from The Great Barrier Reef to a new home in Sydney Harbor. 
Her new address is 42 Wallaby Way.

chunk 2:
She got a good deal from P. Sherman. 
He sold her the house for only $200,000.
```

A contextual embedding model can understand from chunk 1 that "she" in chunk 2 refers to Dory and "the house" in chunk 2 refers to 42 Wallaby Way. Thus, for the query `How much was Dory's new house?`, we would likely retrieve the embedding for chunk 2.

Further, contextual embedding models make it possible to create smaller chunks without losing context. We could split the example into 4 chunks, one per sentence:

```text
chunk 1:
Dory recently moved from The Great Barrier Reef to a new home in Sydney Harbor.

chunk 2:
Her new address is 42 Wallaby Way.

chunk 3:
She got a good deal from P. Sherman. 

chunk 4:
He sold her the house for only $200,000.
```

We would retrieve chunk 4 to answer the query, as its embedding includes the context of the other chunks.

### Tradeoffs of contextual embedding models

Contextual embedding models make it possible to create smaller chunks that still retain the semantic context of the entire document, but they are not a silver bullet, and the tradeoffs should be considered:

1. **Storage costs**: Smaller chunks will result in more embeddings, and thus higher storage costs.
2. **Few models**: There aren't many contextual embedding models currently available, and their performance may vary considerably.
3. **Reduced benefit for long documents**: Longer documents stress the model's attention, making it harder for the model to decide which context should influence the individual chunk embeddings. For documents that approach the model's context limit, the benefits of contextual embedding may become negligible. In this case, consider truncation or a sliding window to break up the document. You may also consider using an LLM to append contextualized prefixes to each chunk (what Anthropic calls [contextual retrieval](https://www.anthropic.com/engineering/contextual-retrieval)), though this adds significant inference cost and embedding latency.
