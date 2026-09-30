# TKWNC_nhom10 — Vườn Hoa AI

**Demo trực tiếp:** https://tkwnc-nhom10.vercel.app/  
**Backend:** https://tkw-nhom10-api.onrender.com  
**Health:** https://tkw-nhom10-api.onrender.com/api/health

Website có bốn chức năng AI: phân loại ảnh hoa, phát hiện vật thể, tìm ảnh bằng chữ/ảnh và chatbot RAG tiếng Việt. Bách khoa và ảnh trưng bày giới thiệu 5 loài; ResNet hiện có 103 nhãn phân loại.

## Xem demo nhanh

Mở demo trực tiếp ở trên để xem giao diện, không cần clone repo.

## Chạy giao diện từ bản clone

Cần Git, Node.js 20.19+ và pnpm. Lệnh PowerShell dưới đây chạy React, gọi backend Render:

```powershell
git clone https://github.com/lehiu1310/TKWNC_nhom10.git
cd TKWNC_nhom10/web
pnpm install
$env:VITE_API_BASE_URL="https://tkw-nhom10-api.onrender.com"
pnpm exec vite --host 0.0.0.0 --port 5175
```

Mở http://localhost:5175. Đây là cách chạy nhanh giao diện. Chạy suy luận đầy đủ cục bộ cần tải dataset, trọng số và tạo artifacts; thời gian chuẩn bị phụ thuộc máy và có thể vượt 15 phút.

## Cấu trúc

- `core/`: ResNet-18, YOLO11, CLIP + FAISS, Gemini + RAG (có thể chọn Qwen local).
- `api/`: FastAPI; các model được nạp khi gọi tính năng tương ứng.
- `web/`: React + Vite.
- `data/kb/`: tám tài liệu tiếng Việt cho RAG.
- `data/species.json`: thông tin loài; UI Bách khoa lọc 5 loài nổi bật.
- `data/display_images.json`: nguồn ảnh trưng bày 5 loài.
- `MODEL_CARD.md`: dữ liệu, chỉ số đã có, giới hạn và rủi ro.

## Bốn chức năng AI

| Chức năng | Kỹ thuật | Giới hạn |
|---|---|---|
| Nhận diện loài hoa | ResNet-18 | 103 nhãn hiện có; xem confidence như gợi ý |
| Phát hiện đối tượng | YOLO11n COCO | Không được fine-tune riêng cho hoa; có thể không nhận diện hoa |
| Tìm ảnh | CLIP ViT-B/32 + FAISS | Tìm ảnh tương tự trong index |
| Chatbot | Gemini + MiniLM + FAISS | Trả lời dựa trên tám tài liệu RAG; cần khóa API |

API: `/api/health`, `/api/species`, `/api/species/{id}/image`, `/api/classify`, `/api/detect`, `/api/search/text`, `/api/search/image`, `/api/gallery/{id}`, `/api/chat` (SSE), `/api/chat/sync`.

## Chạy backend đầy đủ cục bộ

Cần Python 3.11, Internet và vài GB dung lượng trống. Ví dụ trên Windows:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python scripts/prepare_flowers102.py --epochs 3
cd web; pnpm install; pnpm run build; cd ..
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

`prepare_flowers102.py` chuẩn bị Oxford Flowers 102 kết hợp dữ liệu TF Flowers, tạo model 103 nhãn và index ảnh. Số nhãn phân loại không đồng nghĩa số loài trong Bách khoa. Gemini cần `GOOGLE_API_KEY`/`GEMINI_API_KEY` ở backend; không đặt khóa trong frontend.

## Kiểm thử và đo lường

API tests: `python -m pip install -r requirements-test.txt` rồi `python -m pytest -q`. Workflow `.github/workflows/test.yml` chạy test trên GitHub Actions. Benchmark dùng `locustfile.py` và `requirements-benchmark.txt`; p50/p95 và RAM deploy chưa đo được, xem [MODEL_CARD.md](MODEL_CARD.md) để biết các chỉ số thực có và phần còn thiếu.

## Docker

Image nghe cổng 7860. Sau khi chuẩn bị dataset/artifacts:

```bash
docker build -t tkw-nhom10 .
docker run --rm -p 7860:7860 tkw-nhom10
```

Không commit `.env`, cache Hugging Face, dataset hoặc checkpoint vào Git.
