# ---- Tầng 1: build React ----
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY web/ ./
# App.jsx imports the shared JSON catalogue from ../../data, which resolves to /data in this stage.
COPY data/ /data/
# The frontend also imports catalogue model metadata and report snapshots from the repository root.
COPY artifacts/ /artifacts/
COPY reports/ /reports/
COPY MODEL_CARD.md /MODEL_CARD.md
RUN npm run build

# ---- Tầng 2: API Python + mô hình ----
FROM python:3.11-slim
WORKDIR /app
ENV APP_ROOT=/app APP_DB_PATH=/app/.data/vuonhoa.sqlite3 HF_HOME=/app/.cache LLM_MODEL=Qwen/Qwen2.5-0.5B-Instruct TORCH_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1 MALLOC_ARENA_MAX=2 MODEL_WARMUP=1 LLM_PROVIDER=gemini GEMINI_MODEL=gemini-3.5-flash-lite CORS_ORIGINS=https://tkwnc-nhom10.vercel.app,https://tkwnc-nhom10-aq7ahbp1b-tkwnc-nhom10.vercel.app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
 && python -c "import torch, torchvision; open('/tmp/torch-constraints.txt', 'w').write(f'torch=={torch.__version__}\\ntorchvision=={torchvision.__version__}\\n')" \
 && PIP_CONSTRAINT=/tmp/torch-constraints.txt pip install --no-cache-dir -r requirements.txt
# Bake MobileCLIP2 weights into the image so cold starts do not depend on a live Hub download.
RUN python -c "import open_clip; model, _, _ = open_clip.create_model_and_transforms('MobileCLIP2-S0', pretrained='dfndr2b', device='cpu'); del model"
COPY config.py ./
COPY core/ core/
COPY api/ api/
COPY scripts/ scripts/
COPY data/ data/
COPY artifacts/ artifacts/
COPY --from=web /web/dist web/dist
RUN useradd -m app && mkdir -p /app/.data && chown -R app:app /app/.data /app/.cache
USER app
EXPOSE 7860
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
