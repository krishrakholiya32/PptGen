import json
import base64
import httpx
from typing import Optional
from app.core.config import settings


class LLMService:
    """
    Primary: Gemini (gemini-3.1-flash-lite) — better quality, 500 RPD free
    Vision:  Groq (llama-4-scout-17b) — free, analyzes images/slides
    Fallback: Groq (llama-3.1-8b-instant) — 800K tokens/day
    """

    def __init__(self):
        self.groq_headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

    async def generate_text(self, prompt: str, system: str = "", max_tokens: int = 2000) -> str:
        """Generate text content via Gemini. Falls back to Groq if Gemini fails."""
        try:
            return await self._gemini_text(prompt, system, max_tokens)
        except Exception as e:
            print(f"[LLM] Gemini failed: {e}. Trying Groq fallback...")
            try:
                return await self._groq_text(prompt, system, max_tokens)
            except Exception as e2:
                raise RuntimeError(f"All LLM providers failed. Gemini: {e} | Groq: {e2}")

    async def generate_json(self, prompt: str, system: str = "", max_tokens: int = 3000) -> dict:
        """Generate structured JSON output."""
        json_system = system + "\nYou must respond ONLY with valid JSON. No markdown, no explanation, no backticks."
        raw = await self.generate_text(prompt, json_system, max_tokens)
        # Strip any accidental markdown fences
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(raw)

    async def analyze_image(self, image_path: str, prompt: str) -> str:
        """Use vision model to analyze a slide/page image for layout cloning."""
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        # Detect mime type
        ext = image_path.lower().split(".")[-1]
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")

        payload = {
            "model": settings.GROQ_VISION_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                        {"type": "text", "text": prompt}
                    ]
                }
            ],
            "max_tokens": 1500
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=self.groq_headers,
                json=payload
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _groq_text(self, prompt: str, system: str, max_tokens: int) -> str:
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
                headers=self.groq_headers,
                json=payload
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _gemini_text(self, prompt: str, system: str, max_tokens: int) -> str:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("Gemini API key not configured")

        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens}
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


llm = LLMService()
