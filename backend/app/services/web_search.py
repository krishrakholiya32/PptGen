async def get_web_context(prompt: str) -> str:
    """
    Web search has been replaced with a user-provided context field.
    This function is kept for compatibility but returns empty string.
    The actual context is passed directly via the prompt when use_web_search=True.
    """
    return ""
