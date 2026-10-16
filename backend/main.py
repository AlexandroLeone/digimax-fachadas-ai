import asyncio
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

class FacadeRequest(BaseModel):
    width: float = Field(gt=0, le=100)
    height: float = Field(gt=0, le=20)
    style: Literal["Moderno", "Contemporâneo", "Neoclássico", "Industrial"]
    materials: list[str] = Field(min_length=1, max_length=6)
    gateType: str = Field(min_length=2, max_length=80)
    clientNeeds: str = Field(default="", max_length=1500)

    @field_validator("materials")
    @classmethod
    def unique_materials(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

class GeneratedImage(BaseModel):
    id: str
    url: str
    label: str

class FacadeResponse(BaseModel):
    status: str
    mode: str
    superPrompt: str
    images: list[GeneratedImage]

app = FastAPI(title="Digimax Facade AI API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","), allow_credentials=True, allow_methods=["POST", "GET"], allow_headers=["*"])

STYLE_TRANSLATIONS = {"Moderno": "modern", "Contemporâneo": "contemporary", "Neoclássico": "neoclassical", "Industrial": "industrial"}
MATERIAL_TRANSLATIONS = {"Filete de pedra": "natural stacked stone cladding", "Porcelanato amadeirado": "wood-look porcelain panels", "Concreto aparente": "exposed architectural concrete", "Vidro": "architectural glass", "Cobogó": "perforated concrete breeze blocks", "Brise metálico": "metal louvers"}
GATE_TRANSLATIONS = {"Portão Basculante": "tilting garage gate", "Portão de Correr": "sliding gate", "Portão Duplo": "double-leaf gate", "Portão Vazado": "openwork metal gate", "Fechado em Chapa": "solid sheet-metal gate"}
DEMO_IMAGES = ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=92", "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2200&q=92", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=92"]

def build_super_prompt(payload: FacadeRequest) -> str:
    materials = ", ".join(MATERIAL_TRANSLATIONS.get(material, material) for material in payload.materials)
    gate = GATE_TRANSLATIONS.get(payload.gateType, payload.gateType)
    needs = payload.clientNeeds.strip() or "clean pedestrian access and integrated lighting"
    return (f"Architectural front wall and gate design, exact frontage {payload.width:g}m wide by {payload.height:g}m high, {STYLE_TRANSLATIONS[payload.style]} style, featuring {materials}, {gate}, client requirements: {needs}. Straight-on eye-level view, single residential lot, precise buildable geometry, realistic material joints, photorealistic, 8k resolution, architectural exterior photography, daylight rendering, no text, no watermark, no distorted openings.")

async def call_image_provider(prompt: str) -> list[GeneratedImage]:
    """Adapter point for OpenAI, Replicate or fal.ai. Keep API keys in environment variables."""
    provider = os.getenv("IMAGE_PROVIDER", "mock")
    if provider == "mock":
        await asyncio.sleep(1.8)
        return [GeneratedImage(id=f"concept-{index + 1}", url=url, label=f"Conceito {index + 1:02d}") for index, url in enumerate(DEMO_IMAGES)]
    if provider not in {"openai", "replicate", "fal"}:
        raise RuntimeError(f"Unsupported IMAGE_PROVIDER: {provider}")
    raise RuntimeError(f"Provider '{provider}' is configured but its adapter is not implemented yet")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/api/generate-facade", response_model=FacadeResponse)
async def generate_facade(payload: FacadeRequest) -> FacadeResponse:
    try:
        prompt = build_super_prompt(payload)
        images = await call_image_provider(prompt)
        return FacadeResponse(status="success", mode=os.getenv("IMAGE_PROVIDER", "mock"), superPrompt=prompt, images=images)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The image generation provider could not complete the request.") from exc
