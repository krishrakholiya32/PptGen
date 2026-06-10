import asyncio
from app.services.llm_service import llm


DENSITY_SETTINGS = {
    "short": {
        "bullet_count": "2-3",
        "bullet_length": "concise, max 80 characters each",
        "notes_length": "1 sentence",
        "max_bullets": 3,
        "max_chars": 80,
        "enrich_tokens": 500,
    },
    "medium": {
        "bullet_count": "4-5",
        "bullet_length": "clear and informative, max 120 characters each",
        "notes_length": "2-3 sentences",
        "max_bullets": 5,
        "max_chars": 120,
        "enrich_tokens": 700,
    },
    "long": {
        "bullet_count": "7-8",
        "bullet_length": "comprehensive, data-rich sentences with specific facts, statistics, and examples, max 240 characters each",
        "notes_length": "5-6 sentences covering deep context, comparisons, use cases, and expert insights",
        "max_bullets": 8,
        "max_chars": 240,
        "enrich_tokens": 1400,
    },
}

TONE_PROMPTS = {
    "general":   "",
    "executive": "Write for a C-suite executive audience: concise, data-driven, ROI-focused, no jargon.",
    "technical": "Write for a technical audience: precise terminology, include specifics, show depth.",
    "students":  "Write for students: simple language, relatable examples, step-by-step explanations.",
    "sales":     "Write for a sales context: persuasive language, benefit-focused, action-oriented.",
}

# Max concurrent enrichment calls — prevents Groq rate-limit failures
_ENRICH_SEMAPHORE = asyncio.Semaphore(3)


import re

def _extract_personal_info(prompt: str) -> str:
    """
    Detect personal/academic info in the prompt and return a formatted subtitle string.
    Handles: names, enrollment numbers, subjects, institution, date, batch, etc.
    """
    lines = [l.strip() for l in re.split(r"[,\n;|]", prompt) if l.strip()]
    
    # Patterns to detect personal fields
    patterns = {
        "en_no":   re.compile(r"en(?:rollment)?\s*(?:no|num|number|#)?\s*[:\-]?\s*([A-Z0-9]{8,20})", re.I),
        "roll":    re.compile(r"roll\s*(?:no|num|number|#)?\s*[:\-]?\s*([A-Z0-9]{6,20})", re.I),
        "sub":     re.compile(r"sub(?:ject)?\s*[:\-]\s*(.{3,40})", re.I),
        "batch":   re.compile(r"batch\s*[:\-]?\s*(.{2,20})", re.I),
        "sem":     re.compile(r"sem(?:ester)?\s*[:\-]?\s*(\d+|[IVX]+)", re.I),
        "year":    re.compile(r"(?:academic\s+)?year\s*[:\-]?\s*(20\d{2}\s*[-–]\s*20\d{2})", re.I),
        "guided":  re.compile(r"(?:guided|mentor|faculty)\s+by\s*[:\-]?\s*(.{3,40})", re.I),
        "college": re.compile(r"(?:college|university|institute|school)\s*[:\-]?\s*(.{3,60})", re.I),
    }
    
    found = {}
    full_text = prompt
    
    for key, pat in patterns.items():
        m = pat.search(full_text)
        if m:
            found[key] = m.group(1).strip().rstrip(".,")
    
    # Try to detect a name: a line that looks like a proper name (2-4 words, each capitalized)
    # and doesn't match other patterns
    name_pat = re.compile(r"\b([A-Z][a-z]+(\s+[A-Z][a-z]+){1,3})\b")
    skip_words = {"Presented","Created","Made","Submitted","Guided","Faculty","College","University"}
    for line in lines:
        m = name_pat.search(line)
        if m and not any(sw in line for sw in skip_words):
            candidate = m.group(1)
            if 5 <= len(candidate) <= 40 and "name" not in found:
                found["name"] = candidate
                break
    
    if not found:
        return ""
    
    # Build a formatted subtitle — expand all abbreviations to full words
    # Each part is on its own line using " | " as separator (split in renderer)
    parts = []
    if "name"    in found: parts.append(found["name"])
    if "en_no"   in found: parts.append(f"Enrollment No: {found['en_no']}")
    if "roll"    in found: parts.append(f"Roll No: {found['roll']}")
    if "sub"     in found:
        sub_val = found["sub"].strip()
        # Expand known subject abbreviations
        SUB_EXPAND = {
            "aids": "AI & Data Science",
            "ai": "Artificial Intelligence",
            "ds": "Data Science",
            "ml": "Machine Learning",
            "dbms": "Database Management Systems",
            "os": "Operating Systems",
            "cn": "Computer Networks",
            "se": "Software Engineering",
            "toc": "Theory of Computation",
            "daa": "Design & Analysis of Algorithms",
        }
        sub_val = SUB_EXPAND.get(sub_val.lower(), sub_val)
        parts.append(f"Subject: {sub_val}")
    if "sem"     in found:
        sem = found["sem"]
        # Convert digit to ordinal
        ordinals = {"1":"1st","2":"2nd","3":"3rd","4":"4th","5":"5th","6":"6th","7":"7th","8":"8th"}
        sem = ordinals.get(str(sem), sem)
        parts.append(f"Semester: {sem}")
    if "batch"   in found: parts.append(f"Batch: {found['batch']}")
    if "year"    in found: parts.append(f"Academic Year: {found['year']}")
    if "guided"  in found: parts.append(f"Guided by: {found['guided']}")
    if "college" in found: parts.append(found["college"])

    return " | ".join(parts) if parts else ""


class ContentPlanner:

    async def plan_pptx(self, prompt: str, style: dict, slide_count: int = 10,
                        image_files: list = None, content_density: str = "medium",
                        tone: str = "general") -> dict:
        image_files = image_files or []
        density = DENSITY_SETTINGS.get(content_density, DENSITY_SETTINGS["medium"])
        tone_instruction = TONE_PROMPTS.get(tone, "")

        images_info = ""
        if image_files:
            images_info = (
                f"\nAvailable images: {', '.join(image_files)}"
                "\nDecide which images to place on which slides based on context."
            )

        tone_line = f"\nTone/Audience: {tone_instruction}" if tone_instruction else ""

        # Detect personal info (name, roll number, subject, institution) in prompt
        personal_info = _extract_personal_info(prompt)
        personal_instruction = ""
        if personal_info:
            personal_instruction = f'\n- Slide 1 subtitle MUST be exactly: "{personal_info}"'

        outline_prompt = f"""Create a {slide_count}-slide presentation about: {prompt}
{tone_line}
Content density: {density['bullet_count']} bullets per slide, {density['bullet_length']}
Style: {style.get('layout_description', 'Modern professional')}
{images_info}

Return a JSON object with this EXACT structure:
{{
  "title": "Short Presentation Title (3-5 words max)",
  "file_title": "Short_Summary_Name",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Presentation Title",
      "subtitle": "A single compelling sentence that summarizes the key insight or purpose of this presentation",
      "bullets": [],
      "image": null,
      "speaker_notes": "Welcome notes for presenter",
      "layout_type": "title_slide"
    }}
  ]
}}

Layout types: title_slide (slide 1 only), title_content, two_column, image_right, full_image, section_break

CRITICAL RULES:
- "title" field: short (3-5 words), punchy presentation title — NOT the raw user prompt
- "file_title" field: 2-4 words with underscores, e.g. "AI_Overview" or "Marketing_Strategy_Q3"
- Slide 1 subtitle: ONE clean sentence summarizing the presentation — NOT the user's prompt text{personal_instruction}
- Every bullet MUST be a complete, informative sentence — NOT a single word or abbreviation
- Bad bullets: "ML", "NLP", "Deep Learning" — these are headings, not bullet points
- Good bullets: "Machine learning enables systems to learn from data without explicit programming"
- Every non-title slide MUST have exactly {density['bullet_count']} full-sentence bullet points
- Each bullet must be {density['bullet_length']}"""

        plan = await llm.generate_json(outline_prompt, max_tokens=4000)

        slides = plan.get("slides", [])

        # Enrich slides with throttled concurrency (max 3 at a time) to avoid rate limits
        enriched = await asyncio.gather(*[
            self._enrich_slide_throttled(slide, prompt, density, tone_instruction)
            for slide in slides
        ])
        plan["slides"] = list(enriched)
        return plan

    async def _enrich_slide_throttled(self, slide: dict, topic: str,
                                       density: dict, tone_instruction: str) -> dict:
        """Throttled wrapper — max 3 concurrent LLM calls."""
        async with _ENRICH_SEMAPHORE:
            return await self._enrich_slide(slide, topic, density, tone_instruction)

    async def _enrich_slide(self, slide: dict, topic: str,
                             density: dict, tone_instruction: str) -> dict:
        bullets = slide.get("bullets", [])
        if not isinstance(bullets, list):
            bullets = []
            slide["bullets"] = bullets

        layout = slide.get("layout_type", "title_content")
        if layout in ("title_slide", "section_break"):
            return slide

        max_b = density["max_bullets"]
        max_chars = density["max_chars"]

        # Check if bullets are already good: enough count AND actually informative
        # A bullet is informative if it's a sentence (>30 chars), not just a keyword
        def is_informative(b: str) -> bool:
            return len(b.strip()) >= 30

        already_good = (
            len(bullets) >= max_b - 1
            and all(is_informative(b) for b in bullets)
            and len(" ".join(bullets)) > 200
        )

        if already_good:
            slide["bullets"] = [b[:max_chars] for b in bullets[:max_b]]
            return slide

        tone_line = f"\nTone: {tone_instruction}" if tone_instruction else ""

        enrich_prompt = f"""Write {density['bullet_count']} bullet points for a presentation slide.

Topic: {topic}
Slide title: {slide.get('title')}
{tone_line}

RULES:
- Each bullet must be a COMPLETE, INFORMATIVE sentence (not a single word or abbreviation)
- Include specific facts, numbers, or examples where possible
- Length: {density['bullet_length']}
- Speaker notes: {density['notes_length']}

BAD examples (do NOT do this):
- "Machine Learning"
- "NLP"
- "Deep Learning algorithms"

GOOD examples:
- "Supervised learning trains models on labeled datasets to predict outcomes with 95%+ accuracy"
- "Natural Language Processing enables computers to understand, interpret, and generate human text"

Return JSON only:
{{
  "bullets": ["full sentence 1", "full sentence 2", "full sentence 3"],
  "speaker_notes": "detailed notes here"
}}"""

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                result = await llm.generate_json(enrich_prompt, max_tokens=density["enrich_tokens"])
                new_bullets = result.get("bullets", [])
                if (isinstance(new_bullets, list)
                        and len(new_bullets) >= 2
                        and all(isinstance(b, str) for b in new_bullets)):
                    # Validate bullets are actually informative sentences
                    good = [b for b in new_bullets if is_informative(b)]
                    if len(good) >= 2:
                        result["bullets"] = [b[:max_chars] for b in good[:max_b]]
                        slide.update(result)
                        return slide
            except Exception as e:
                if attempt < max_retries:
                    await asyncio.sleep(1.5 * (attempt + 1))  # back-off before retry
                else:
                    print(f"[ContentPlanner] Enrichment failed for '{slide.get('title')}': {e}")

        # Fallback: if enrichment totally failed, try once more with a simpler prompt
        try:
            simple_prompt = f"""Write {density['bullet_count']} informative sentences about "{slide.get('title')}" in the context of "{topic}". 
Each sentence should be 15-25 words. Return JSON: {{"bullets": ["sentence 1", "sentence 2", "sentence 3"]}}"""
            result = await llm.generate_json(simple_prompt, max_tokens=400)
            if result.get("bullets"):
                slide["bullets"] = [b[:max_chars] for b in result["bullets"][:max_b]]
        except Exception:
            pass

        return slide


planner = ContentPlanner()
