import asyncio
from typing import Optional


async def get_web_context(prompt: str, max_results: int = 5) -> str:
    """Fetch live DuckDuckGo results and return them as a formatted context string."""
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, _ddg_search, prompt, max_results)
        if not results:
            return ""
        lines = ["\n\n[WEB SEARCH CONTEXT — use these current facts to enrich your content]"]
        for r in results:
            lines.append(f"- {r['title']}: {r['body']}")
        return "\n".join(lines)
    except Exception as e:
        print(f"[WebSearch] Failed: {e}")
        return ""


def _ddg_search(query: str, max_results: int) -> list:
    from duckduckgo_search import DDGS
    with DDGS() as ddgs:
        return list(ddgs.text(query, max_results=max_results))
