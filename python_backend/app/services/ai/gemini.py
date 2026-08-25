import google.generativeai as genai
from app.core.config import settings
import logging
import json
import asyncio
from typing import TypeVar, Type
from pydantic import BaseModel

logger = logging.getLogger(__name__)

MAX_AI_RETRIES = 3
AI_RETRY_BASE_DELAY_MS = 1000

class GeminiService:
    def __init__(self):
        self.model = None
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                safety_settings=[
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
                ]
            )
        else:
            logger.warning("GEMINI_API_KEY not set - AI features disabled")

    def _ensure_model(self):
        if not self.model:
            raise Exception("AI service not configured. Please set GEMINI_API_KEY.")
        return self.model

    async def generate_json(self, system_prompt: str, user_prompt: str, response_model: Type[BaseModel], max_output_tokens: int = 4096) -> BaseModel:
        model = self._ensure_model()
        
        last_error = None
        
        for attempt in range(MAX_AI_RETRIES):
            try:
                # google-generativeai supports generate_content_async
                result = await model.generate_content_async(
                    contents=f"{system_prompt}\n\n---\n\n{user_prompt}",
                    generation_config=genai.types.GenerationConfig(
                        response_mime_type="application/json",
                        max_output_tokens=max_output_tokens,
                        temperature=0.7,
                    )
                )
                
                text = result.text
                if not text or not text.strip():
                    raise ValueError("Empty response from AI")
                    
                json_str = text.strip()
                if json_str.startswith("```"):
                    json_str = json_str.lstrip("```json\n").lstrip("```\n").rstrip("\n```")
                    
                # Pydantic validation handles repair/casting automatically
                parsed = response_model.model_validate_json(json_str)
                return parsed
                
            except Exception as e:
                last_error = e
                logger.warning(f"AI generation attempt {attempt + 1} failed: {e}")
                
                if "429" in str(e).lower() or "rate limit" in str(e).lower():
                    delay = (AI_RETRY_BASE_DELAY_MS * (2 ** attempt)) / 1000.0
                    await asyncio.sleep(delay)
                    continue
                    
                if attempt < MAX_AI_RETRIES - 1:
                    delay = (AI_RETRY_BASE_DELAY_MS * (2 ** attempt)) / 1000.0
                    await asyncio.sleep(delay)
                    
        logger.error(f"AI generation failed after all retries: {last_error}")
        raise Exception("AI service temporarily unavailable. Please try again.")

gemini_service = GeminiService()
