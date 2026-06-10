import os
import io
import httpx
from app.core.config import settings

SKIP_LAYOUTS = ("title_slide",)


def crop_image_to_ratio(img_bytes: bytes, target_w: int, target_h: int) -> bytes:
    """Crop image to target aspect ratio from center using Pillow."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        orig_w, orig_h = img.size
        target_ratio = target_w / target_h
        orig_ratio = orig_w / orig_h

        if orig_ratio > target_ratio:
            # Too wide — crop sides
            new_w = int(orig_h * target_ratio)
            left = (orig_w - new_w) // 2
            img = img.crop((left, 0, left + new_w, orig_h))
        elif orig_ratio < target_ratio:
            # Too tall — crop top/bottom
            new_h = int(orig_w / target_ratio)
            top = (orig_h - new_h) // 2
            img = img.crop((0, top, orig_w, top + new_h))

        out = io.BytesIO()
        img.convert("RGB").save(out, format="JPEG", quality=92)
        return out.getvalue()
    except Exception as e:
        print(f"[ImageFetcher] Crop failed: {e}")
        return img_bytes


def get_target_ratio(layout: str):
    """Return (w, h) pixel ratio for cropping based on layout slot."""
    if layout in ("image_top", "image_bottom", "full_image"):
        return (1600, 900)   # 16:9 wide
    elif layout in ("image_right", "image_left"):
        return (800, 600)    # 4:3 half-width
    return (1600, 900)


async def fetch_from_unsplash(client: httpx.AsyncClient, query: str) -> str | None:
    if not settings.UNSPLASH_ACCESS_KEY:
        return None
    try:
        resp = await client.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": 3, "orientation": "landscape"},
            headers={"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"},
            timeout=10
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return results[0]["urls"]["regular"]
    except Exception as e:
        print(f"[ImageFetcher] Unsplash failed for '{query}': {e}")
    return None


async def fetch_from_pexels(client: httpx.AsyncClient, query: str) -> str | None:
    if not settings.PEXELS_API_KEY:
        return None
    try:
        resp = await client.get(
            "https://api.pexels.com/v1/search",
            params={"query": query, "per_page": 3, "orientation": "landscape"},
            headers={"Authorization": settings.PEXELS_API_KEY},
            timeout=10
        )
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if photos:
            return photos[0]["src"]["large"]
    except Exception as e:
        print(f"[ImageFetcher] Pexels failed for '{query}': {e}")
    return None


async def fetch_from_pixabay(client: httpx.AsyncClient, query: str) -> str | None:
    if not settings.PIXABAY_API_KEY:
        return None
    try:
        resp = await client.get(
            "https://pixabay.com/api/",
            params={
                "key": settings.PIXABAY_API_KEY,
                "q": query,
                "image_type": "photo",
                "orientation": "horizontal",
                "per_page": 3,
                "safesearch": "true"
            },
            timeout=10
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
        if hits:
            return hits[0]["largeImageURL"]
    except Exception as e:
        print(f"[ImageFetcher] Pixabay failed for '{query}': {e}")
    return None


async def fetch_image_url(client: httpx.AsyncClient, query: str) -> str | None:
    """Try Unsplash → Pexels → Pixabay in order."""
    url = await fetch_from_unsplash(client, query)
    if url:
        return url
    url = await fetch_from_pexels(client, query)
    if url:
        return url
    url = await fetch_from_pixabay(client, query)
    return url


async def fetch_images_for_slides(slides: list, session_dir: str) -> list:
    has_any_key = any([
        settings.UNSPLASH_ACCESS_KEY,
        settings.PEXELS_API_KEY,
        settings.PIXABAY_API_KEY
    ])
    if not has_any_key:
        print("[ImageFetcher] No image API keys configured")
        return slides

    os.makedirs(session_dir, exist_ok=True)

    async with httpx.AsyncClient(timeout=30) as client:
        for slide in slides:
            existing = slide.get("image")
            if existing:
                full_path = os.path.join(session_dir, existing)
                if os.path.exists(full_path):
                    print(f"[ImageFetcher] Slide {slide.get('slide_number')}: already has real image {existing}")
                    continue
                else:
                    print(f"[ImageFetcher] Slide {slide.get('slide_number')}: AI invented filename '{existing}', fetching real one")
                    slide["image"] = None

            layout = slide.get("layout_type", "")
            if layout in SKIP_LAYOUTS:
                continue

            title = slide.get("title", "")
            queries = [
                title[:50],
                title.split(":")[0][:30],
                " ".join(title.split()[:3]),
                "professional background abstract",
            ]
            queries = [q.strip() for q in queries if q.strip()]

            downloaded = False
            for query in queries:
                img_url = await fetch_image_url(client, query)
                if not img_url:
                    continue
                try:
                    img_resp = await client.get(img_url, timeout=30)
                    img_resp.raise_for_status()

                    # Crop to correct aspect ratio for the layout
                    ratio_w, ratio_h = get_target_ratio(layout)
                    cropped = crop_image_to_ratio(img_resp.content, ratio_w, ratio_h)

                    img_filename = f"auto_{slide.get('slide_number', id(slide))}.jpg"
                    img_path = os.path.join(session_dir, img_filename)
                    with open(img_path, "wb") as f:
                        f.write(cropped)

                    slide["image"] = img_filename
                    if slide.get("layout_type") in ("title_content", "blank", "two_column"):
                        slide["layout_type"] = "image_right"

                    print(f"[ImageFetcher] ✓ '{query}' → {img_filename}")
                    downloaded = True
                    break
                except Exception as e:
                    print(f"[ImageFetcher] ✗ Download failed for '{query}': {e}")
                    continue

            if not downloaded:
                print(f"[ImageFetcher] No image for slide: {slide.get('title')}")

    return slides
