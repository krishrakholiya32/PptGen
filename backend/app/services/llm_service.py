import json
import base64
import httpx
from app.core.config import settings


class LLMService:
    """
    Primary: Gemini (gemini-3.1-flash-lite) — 500 RPD per key
    Fallback: Groq (openai/gpt-oss-120b) — 14,400 TPD per key
    Vision:  Gemini (natively multimodal) primary, Groq (qwen/qwen3.6-27b) fallback
    Multiple keys per provider rotate automatically on 429.
    """

    def __init__(self):
        pass

    def _groq_headers(self, key: str) -> dict:
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async def generate_text(self, prompt: str, system: str = "", max_tokens: int = 2000) -> str:
        """Try all Gemini keys, then all Groq keys."""
        gemini_errors = []
        for key in settings.all_gemini_keys:
            try:
                return await self._gemini_text(prompt, system, max_tokens, key)
            except Exception as e:
                gemini_errors.append(str(e))
                print(f"[LLM] Gemini key ...{key[-6:]} failed: {e}")

        groq_errors = []
        for key in settings.all_groq_keys:
            try:
                return await self._groq_text(prompt, system, max_tokens, key)
            except Exception as e:
                groq_errors.append(str(e))
                print(f"[LLM] Groq key ...{key[-6:]} failed: {e}")

        raise RuntimeError(f"All providers exhausted. Gemini: {gemini_errors} | Groq: {groq_errors}")

    async def generate_json(self, prompt: str, system: str = "", max_tokens: int = 3000) -> dict:
        json_system = system + "\nYou must respond ONLY with valid JSON. No markdown, no explanation, no backticks."
        raw = await self.generate_text(prompt, json_system, max_tokens)
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(raw)

    async def analyze_image(self, image_path: str, prompt: str) -> str:
        """Analyze a slide/page image for layout cloning. Gemini (natively
        multimodal) is tried first, then Groq's vision model, matching the
        text path's Gemini-primary/Groq-fallback order."""
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        ext = image_path.lower().split(".")[-1]
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")

        for key in settings.all_gemini_keys:
            try:
                return await self._gemini_vision(image_data, mime, prompt, key)
            except Exception as e:
                print(f"[LLM] Gemini vision key ...{key[-6:]} failed: {e}")

        payload = {
            "model": settings.GROQ_VISION_MODEL,
            "messages": [{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                {"type": "text", "text": prompt}
            ]}],
            "max_tokens": 1500
        }

        for key in settings.all_groq_keys:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=self._groq_headers(key),
                        json=payload
                    )
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"[LLM] Groq vision key ...{key[-6:]} failed: {e}")

        raise RuntimeError("All Gemini and Groq vision keys failed")

    async def embed_texts(self, texts: list[str]) -> list[list[float]] | None:
        """Gemini-only (Groq has no embedding endpoint) — returns None rather than
        raising if every key fails, so callers can degrade gracefully instead of
        breaking generation over an embedding-only outage."""
        for key in settings.all_gemini_keys:
            try:
                return await self._gemini_embed(texts, key)
            except Exception as e:
                print(f"[LLM] Gemini embed key ...{key[-6:]} failed: {e}")
        return None

    async def _gemini_embed(self, texts: list[str], key: str) -> list[list[float]]:
        payload = {
            "requests": [
                {"model": "models/gemini-embedding-001", "content": {"parts": [{"text": t}]}}
                for t in texts
            ]
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return [e["values"] for e in resp.json()["embeddings"]]

    async def _gemini_vision(self, image_data_b64: str, mime: str, prompt: str, key: str) -> str:
        payload = {
            "contents": [{"parts": [
                {"inline_data": {"mime_type": mime, "data": image_data_b64}},
                {"text": prompt},
            ]}]
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    async def _groq_text(self, prompt: str, system: str, max_tokens: int, key: str) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.GROQ_TEXT_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=self._groq_headers(key),
                json=payload
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _gemini_text(self, prompt: str, system: str, max_tokens: int, key: str) -> str:
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens}
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


llm = LLMService()
