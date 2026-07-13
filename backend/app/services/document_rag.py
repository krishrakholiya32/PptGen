"""
Retrieval helpers for grounding presentation generation in an uploaded source
document. Used only when the extracted document text exceeds
MAX_DOCUMENT_CONTEXT_CHARS (see generate.py) -- a document that already fits
is used in full, unchanged, no retrieval involved.

Deliberately in-memory and one-shot: generation.py's document-grounding flow
reads a document once per generation request and never revisits it, so there's
no persistence here, no new database table, no numpy -- just a lightweight
chunker and pure-Python cosine similarity, computed fresh each time and
discarded.
"""

import math

from app.services.llm_service import LLMService


def chunk_text(text: str, target_chars: int = 1200) -> list[str]:
    """Paragraph-aware chunker: packs consecutive paragraphs up to
    target_chars, hard-cutting only a single paragraph that alone exceeds it."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(para) > target_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(para), target_chars):
                chunks.append(para[i:i + target_chars])
            continue
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) > target_chars and current:
            chunks.append(current)
            current = para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def select_relevant_chunks(
    chunks: list[str], query: str, llm: LLMService, budget_chars: int
) -> list[str] | None:
    """Embeds all chunks + the query in one call, ranks chunks by similarity
    to the query, greedily keeps the highest-scoring ones within budget_chars
    (in their original document order, not score order, so the presentation
    still reads the material front-to-back). Returns None if embedding failed
    -- signals the caller to fall back to plain truncation."""
    if not chunks:
        return []
    embeddings = await llm.embed_texts(chunks + [query])
    if embeddings is None:
        return None
    chunk_embeddings, query_embedding = embeddings[:-1], embeddings[-1]

    scored = sorted(
        range(len(chunks)),
        key=lambda i: cosine_similarity(chunk_embeddings[i], query_embedding),
        reverse=True,
    )

    selected_indices: list[int] = []
    used_chars = 0
    for i in scored:
        chunk_len = len(chunks[i])
        if used_chars + chunk_len > budget_chars and selected_indices:
            continue
        selected_indices.append(i)
        used_chars += chunk_len
        if used_chars >= budget_chars:
            break

    selected_indices.sort()
    return [chunks[i] for i in selected_indices]
