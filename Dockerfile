# ---- Tầng 1: build React ----
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY web/ ./
# App.jsx imports the shared JSON catalogue from ../../data, which resolves to /data in this stage.
COPY data/ /data/
RUN npm run build

# ---- Tầng 2: API Python + mô hình ----
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt
COPY config.py ./
COPY core/ core/
COPY api/ api/
COPY scripts/ scripts/
COPY data/ data/
COPY artifacts/ artifacts/
COPY --from=web /web/dist web/dist
ENV APP_ROOT=/app HF_HOME=/app/.cache LLM_MODEL=Qwen/Qwen2.5-0.5B-Instruct
RUN useradd -m app && chown -R app /app
USER app
EXPOSE 7860
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
