from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .migrations import initialize_database
from .routers import profile, terms


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Memoricks API",
    description="Backend para o sistema de memorização de idiomas Memoricks com suporte a IA",
    version="2.0.0",
)

# Configuração do Middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra os roteadores de endpoints
app.include_router(terms.router)
app.include_router(profile.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do Memoricks! Acesse /docs para a documentação."}
