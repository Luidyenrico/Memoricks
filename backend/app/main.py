from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .migrations import initialize_database
from .routers import cards, collections, profile, statistics
from .auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Memoricks API",
    description="Memorização de qualquer assunto com temas, subgrupos e cards personalizáveis",
    version="3.0.0",
)

# Configuração do Middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra os roteadores de endpoints
app.include_router(collections.router)
app.include_router(cards.router)
app.include_router(profile.router)
app.include_router(statistics.router)
app.include_router(auth_router)


@app.get("/")
def read_root():
    return {
        "message": "Bem-vindo à API do Memoricks! Acesse /docs para a documentação."
    }
