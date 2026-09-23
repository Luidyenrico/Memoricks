"""Run the real API against a disposable database for browser tests."""

import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
workspace = tempfile.TemporaryDirectory(
    prefix="memoricks-browser-", ignore_cleanup_errors=True
)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(workspace.name).as_posix()}/browser.db"
os.environ["GROQ_API_KEY"] = ""
os.environ["MULTIUSER_ENABLED"] = "1" if os.environ.get("MEMORICKS_AUTH_E2E") == "1" else "0"
if os.environ["MULTIUSER_ENABLED"] == "1":
    os.environ["MEMORICKS_OWNER_EMAIL"] = "owner@example.com"
    os.environ["GOOGLE_CLIENT_ID"] = "e2e.apps.googleusercontent.com"
os.environ["CORS_ORIGINS"] = "http://127.0.0.1:3100"

if __name__ == "__main__":
    import uvicorn
    from app.database import engine

    try:
        uvicorn.run("app.main:app", host="127.0.0.1", port=8100)
    finally:
        engine.dispose()
        workspace.cleanup()
