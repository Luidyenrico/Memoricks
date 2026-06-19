# Memoricks - Backend API

Esta é a API do projeto **Memoricks**, desenvolvida com **FastAPI**, **SQLAlchemy** e **SQLite**.

## Pré-requisitos

* Python 3.9+ instalado.

## Como Executar Localmente

1. **Criar um ambiente virtual (venv):**
   ```powershell
   python -m venv venv
   ```

2. **Ativar o ambiente virtual:**
   * No Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate
     ```
   * No Linux/macOS:
     ```bash
     source venv/bin/activate
     ```

3. **Instalar as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Executar o servidor FastAPI:**
   ```bash
   uvicorn app.main:app --reload
   ```

5. **Acessar a documentação interativa:**
   * Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   * Redoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

Ao iniciar o servidor pela primeira vez, o arquivo de banco de dados SQLite `memoricks.db` será criado automaticamente na pasta raiz do backend.
