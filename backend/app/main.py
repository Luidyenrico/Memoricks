from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

from .database import engine, Base
from .routers import terms

# Cria as tabelas do banco de dados SQLite
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Memoricks API",
    description="Backend para o sistema de memorização de idiomas Memoricks com suporte a IA",
    version="2.0.0",
)

# Configuração do Middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em desenvolvimento. Ajustar em produção se necessário
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra os roteadores de endpoints
app.include_router(terms.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do Memoricks! Acesse /docs para a documentação."}
