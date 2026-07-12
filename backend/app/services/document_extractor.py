"""
Document text extraction for PptGen's "generate slides from a document" feature.

Pure text extraction only — no vision/image fallback needed (unlike kGPT's
file_extractor.py), since this is source material for slide content, not a
one-off attachment needing a described-image fallback.
"""

from pathlib import Path

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def extract_text(data: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(data)
    if ext == ".docx":
        return _extract_docx(data)
    if ext in (".txt", ".md"):
        return data.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported document type '{ext}'. Allowed: pdf, docx, txt, md.")


def _extract_pdf(data: bytes) -> str:
    import fitz  # pymupdf

    doc = fitz.open(stream=data, filetype="pdf")
    return "\n".join(page.get_text() for page in doc).strip()


def _extract_docx(data: bytes) -> str:
    from io import BytesIO

    import docx

    doc = docx.Document(BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
