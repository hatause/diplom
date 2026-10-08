"""Compatibility import for the original test generator. One shared AI client."""
from app.services.gemini_service import GeminiService, gemini_service

__all__ = ["GeminiService", "gemini_service"]
