import os

print({k: bool(v) for k, v in os.environ.items() if "OPENAI" in k or "API" in k})
