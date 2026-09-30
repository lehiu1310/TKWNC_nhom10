# TKWNC_nhom10 — Vườn Hoa AI

Website khám phá hoa qua bốn chức năng AI lấy từ notebook môn học: phân loại ảnh, phát hiện đối tượng, tìm kiếm ảnh bằng chữ hoặc ảnh, và chatbot RAG tiếng Việt.

## Kiến trúc

- `core/`: suy luận dùng chung — ResNet-18 (103 lớp hoa), YOLO11, CLIP + FAISS và Gemini + RAG (có thể chọn Qwen local).
- `api/`: FastAPI cho web và Streamlit. Mô hình được nạp lần đầu khi mở tính năng tương ứng để trang/API khởi động nhanh.
- `web/`: React + Vite, trải nghiệm responsive theo chủ đề vườn hoa.
- `data/kb/`: tài liệu tiếng Việt cho chatbot; mỗi chủ đề bắt đầu bằng tiêu đề `## `.
- `data/species.json`: dữ liệu năm loài dùng trong bách khoa và giao diện.

## Cần cài

- Python 3.11
- Node.js 20.19 trở lên
- Kết nối Internet lần đầu để tải Flowers và trọng số mô hình
- GPU giúp khởi tạo nhanh hơn; CPU vẫn chạy được nhưng thời gian chuẩn bị/inference lâu hơn

## Chạy lần đầu trên Windows

Mở PowerShell ở thư mục dự án:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python scripts/prepare_flowers102.py --epochs 3
cd web
pnpm install
pnpm run build
cd ..
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

`prepare_flowers102.py` tải Oxford Flowers 102 (8.189 ảnh, 102 lớp), ghép dữ liệu cũ để giữ lớp tulip, tạo bách khoa 103 loài và fine-tune ResNet-18 trên 11.859 ảnh. CLIP + FAISS dùng tối đa 12 ảnh đại diện mỗi loài (1.236 ảnh hiện tại) để đủ phủ toàn danh mục mà không mất hàng giờ mã hoá trên CPU. Danh sách 102 lớp của Oxford chủ yếu là các loài phổ biến ở Anh, không đại diện cho mọi loài hoa trên thế giới. Đây là bước chuẩn bị một lần; lần đầu cần Internet, vài GB dung lượng trống và có thể mất nhiều phút trên CPU. YOLO11, mô hình dịch Việt–Anh và embedding được tải khi mở chức năng lần đầu. Gemini yêu cầu `GOOGLE_API_KEY`/`GEMINI_API_KEY`; `LLM_PROVIDER=hf_local` sẽ dùng Qwen local và có thể đổi model bằng `LLM_MODEL`.

Khi phát triển React riêng, mở **hai terminal và giữ cả hai chạy cùng lúc**:

1. Terminal backend, tại thư mục gốc: `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000`.
2. Terminal frontend: `cd web` rồi `pnpm exec vite --host 0.0.0.0 --port 5175`.

Mở địa chỉ Vite vừa in ra (mặc định ép cổng `5175` theo lệnh trên). Vite proxy `/api` tới FastAPI ở `http://localhost:8000`, vì vậy cấu hình mặc định không cần CORS. Nếu frontend gọi trực tiếp backend, đặt `VITE_API_BASE_URL=http://localhost:8000` trong `web/.env.local`; backend cho phép origin localhost ở cổng 5173 và 5175 theo `CORS_ORIGINS`. Có thể dùng `VITE_API_URL` như tên cũ.

## Bốn chức năng

| Tên trên web | Mô hình | Dữ liệu / giới hạn |
|---|---|---|
| Kính lúp hoa | ResNet-18 | 103 lớp: Oxford Flowers 102 + lớp tulip từ TF Flowers |
| Mắt thần vườn | YOLO11n | Checkpoint COCO 80 lớp trong notebook; không phải detector huấn luyện riêng cho hoa, có thể nhận hoa thành “potted plant” |
| Album hoa | CLIP ViT-B/32 + FAISS | Tìm ảnh trong bộ Flowers; câu tiếng Việt được dịch cục bộ sang tiếng Anh trước khi mã hoá |
| Cô làm vườn | Gemini API (mặc định) + MiniLM + FAISS | RAG truy xuất tám tài liệu hoa trong `data/kb/`; Qwen local là tùy chọn |

API: `/api/health`, `/api/species`, `/api/species/{id}/image`, `/api/classify`, `/api/detect`, `/api/search/text`, `/api/search/image`, `/api/gallery/{id}`, `/api/chat` (SSE), `/api/chat/sync`.

## Cấu hình

Các biến môi trường backend chính: `ENABLED_MODELS`, `LLM_PROVIDER` (`gemini` mặc định hoặc `hf_local`), `GEMINI_MODEL`, `GOOGLE_API_KEY` (hoặc `GEMINI_API_KEY`), `LLM_MODEL`, `CLIP_MODEL`, `TRANSLATION_MODEL`, `EMBED_MODEL`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`, `APP_ROOT`. Không đặt khóa Gemini trong frontend. Frontend hỗ trợ `VITE_API_BASE_URL` (ưu tiên) và `VITE_API_URL`; để trống thì dùng proxy `/api` của Vite tới cổng 8000.

Model Card và giới hạn/chỉ số hiện có: [MODEL_CARD.md](MODEL_CARD.md). API tests: `python -m pip install -r requirements-test.txt` rồi `python -m pytest -q`. GitHub Actions chạy cùng bộ test mỗi lần push/pull request. `locustfile.py` kiểm tra bốn route AI; cần backend deploy và `FLOWER_TEST_IMAGE` trước khi có thể ghi số benchmark thật.

Không đưa cache Hugging Face, ảnh dataset hoặc checkpoint vào Git. Thư mục `artifacts/`, ảnh hoa, index và `web/node_modules/` đã được loại khỏi Git.

## Docker

Image dùng cổng 7860. Chạy `python scripts/prepare_flowers102.py --epochs 3` trước khi build để Docker nhận dataset hoa, checkpoint phân loại và chỉ mục tìm kiếm, sau đó:

```bash
docker build -t tkw-nhom10 .
docker run --rm -p 7860:7860 tkw-nhom10
```
