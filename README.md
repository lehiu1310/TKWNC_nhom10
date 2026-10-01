# TKWNC_nhom10 — Vườn Hoa AI

**Demo trực tiếp:** https://tkwnc-nhom10.vercel.app/  
**Backend demo (Render):** https://tkw-nhom10-api.onrender.com  
**Health check:** https://tkw-nhom10-api.onrender.com/api/health

Website giới thiệu 5 loài hoa nổi bật, với bốn chức năng AI lấy từ notebook môn học: phân loại ảnh, phát hiện đối tượng, tìm kiếm ảnh bằng chữ hoặc ảnh, và chatbot RAG tiếng Việt. ResNet hiện có 103 nhãn phân loại; Bách khoa và ảnh trưng bày giới thiệu 5 loài đã chọn.

## Kiến trúc

- `core/`: suy luận dùng chung — ResNet-18 (103 nhãn), YOLO11, MobileCLIP2-S0 + FAISS và Gemini + RAG với truy xuất BM25 nhẹ (có thể chọn Qwen local).
- `api/`: FastAPI cho web và Streamlit. Mô hình được nạp lần đầu khi mở tính năng tương ứng để trang/API khởi động nhanh.
- `web/`: React + Vite, trải nghiệm responsive theo chủ đề vườn hoa.
- `data/kb/`: tài liệu tiếng Việt cho chatbot; mỗi chủ đề bắt đầu bằng tiêu đề `## `.
- `data/species.json`: dữ liệu loài và nhãn phân loại; Bách khoa trên web giới thiệu 5 loài nổi bật.
- `data/display_images.json`: nguồn ảnh đại diện cho 5 loài hiển thị.

## Cần cài

- Python 3.11
- Node.js 20.19 trở lên
- Kết nối Internet lần đầu để tải Flowers và trọng số mô hình
- GPU giúp khởi tạo nhanh hơn; CPU vẫn chạy được nhưng thời gian chuẩn bị/inference lâu hơn

## Demo và chạy nhanh trong 15 phút

Cách nhanh nhất là mở [demo trực tiếp](https://tkwnc-nhom10.vercel.app/); không cần cài gì. Nếu cần clone và chạy giao diện trên máy, chỉ cần Git, Node.js 22 LTS và Corepack (đi kèm Node). Lệnh dưới đây dùng backend Render đã deploy nên **không cần cài Python, tải model hay tạo khóa Gemini**:

```powershell
git clone https://github.com/lehiu1310/TKWNC_nhom10.git
cd TKWNC_nhom10/web
corepack pnpm install --frozen-lockfile
$env:VITE_API_BASE_URL="https://tkw-nhom10-api.onrender.com"
corepack pnpm dev -- --host 0.0.0.0 --port 5175
```

Mở `http://localhost:5175`. Khi dùng chức năng AI lần đầu, Render free có thể cần khởi động lại sau thời gian không hoạt động; chờ cold start rồi thử lại. Bộ cài local đầy đủ cho backend ở mục tiếp theo cần tải dữ liệu/model và có thể lâu hơn 15 phút; cách trên là quy trình clone/chạy nhanh để xem đầy đủ giao diện và gọi backend đã deploy.

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

`prepare_flowers102.py` tải Oxford Flowers 102 (8.189 ảnh, 102 lớp), ghép dữ liệu để fine-tune ResNet-18 trên 11.859 ảnh với 103 nhãn. Bách khoa trên web chỉ giới thiệu 5 loài nổi bật; 103 nhãn là phạm vi phân loại của model, không phải số loài trong Bách khoa. MobileCLIP2-S0 + FAISS dùng tối đa 12 ảnh đại diện mỗi nhãn (1.236 ảnh hiện tại); index đi cùng mã nguồn và `encoder.json` xác nhận model dùng để tạo vector. Danh sách lớp Oxford chủ yếu gồm hoa phổ biến ở Anh, không đại diện cho mọi loài hoa trên thế giới. Chuẩn bị dữ liệu/trọng số là bước một lần, cần Internet và vài GB dung lượng; thời gian trên CPU phụ thuộc máy và có thể vượt 15 phút. YOLO11, MobileCLIP2-S0 và mô hình dịch Việt–Anh được tải khi mở chức năng lần đầu. Chatbot dùng BM25 trên tài liệu tiếng Việt để giảm RAM, Gemini yêu cầu `GOOGLE_API_KEY`/`GEMINI_API_KEY`; `LLM_PROVIDER=hf_local` dùng Qwen local và có thể đổi model bằng `LLM_MODEL`.

Khi phát triển React riêng, mở **hai terminal và giữ cả hai chạy cùng lúc**:

1. Terminal backend, tại thư mục gốc: `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000`.
2. Terminal frontend: `cd web` rồi `pnpm exec vite --host 0.0.0.0 --port 5175`.

Mở địa chỉ Vite vừa in ra (mặc định ép cổng `5175` theo lệnh trên). Vite proxy `/api` tới FastAPI ở `http://localhost:8000`, vì vậy cấu hình mặc định không cần CORS. Nếu frontend gọi trực tiếp backend, đặt `VITE_API_BASE_URL=http://localhost:8000` trong `web/.env.local`; backend cho phép origin localhost ở cổng 5173 và 5175 theo `CORS_ORIGINS`. Có thể dùng `VITE_API_URL` như tên cũ.

## Bốn chức năng

| Tên trên web | Mô hình | Dữ liệu / giới hạn |
|---|---|---|
| Kính lúp hoa | ResNet-18 | 103 lớp: Oxford Flowers 102 + lớp tulip từ TF Flowers |
| Mắt thần vườn | YOLO11n | Checkpoint COCO 80 lớp trong notebook; không phải detector huấn luyện riêng cho hoa, có thể nhận hoa thành “potted plant” |
| Album hoa | MobileCLIP2-S0 + FAISS | Tìm ảnh trong bộ Flowers; câu tiếng Việt được dịch cục bộ sang tiếng Anh trước khi mã hoá |
| Cô làm vườn | Gemini API (mặc định) + BM25 | RAG truy xuất tám tài liệu hoa trong `data/kb/`; Qwen local là tùy chọn |

API gồm 10 endpoint: `/api/health`, `/api/species`, `/api/species/{id}/image`, `/api/classify`, `/api/detect`, `/api/search/text`, `/api/search/image`, `/api/gallery/{id}`, `/api/chat` (SSE), `/api/chat/sync`. Endpoint `/api/species` hỗ trợ `limit` và `offset`; `/api/health` có thể lọc trạng thái bằng `?model=classifier`.

## Cấu hình

Các biến môi trường backend chính: `ENABLED_MODELS`, `LLM_PROVIDER` (`gemini` mặc định hoặc `hf_local`), `GEMINI_MODEL`, `GOOGLE_API_KEY` (hoặc `GEMINI_API_KEY`), `LLM_MODEL`, `CLIP_MODEL` (mặc định `MobileCLIP2-S0`), `CLIP_PRETRAINED` (mặc định `dfndr2b`), `TRANSLATION_MODEL`, `EMBED_MODEL`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`, `APP_ROOT`. Không đặt khóa Gemini trong frontend. Frontend hỗ trợ `VITE_API_BASE_URL` (ưu tiên) và `VITE_API_URL`; để trống thì dùng proxy `/api` của Vite tới cổng 8000.

Model Card và giới hạn/chỉ số hiện có: [MODEL_CARD.md](MODEL_CARD.md). Chạy lại metric ResNet trên validation split bằng `python scripts/evaluate_classifier.py`; đo image retrieval bằng query không có trong index với `python scripts/evaluate_retrieval.py --queries-per-class 2`. Chạy API tests bằng `python -m pip install -r requirements-test.txt` rồi `python -m pytest -q`; bộ test dùng model giả nên không tải checkpoint hay cần GPU. Bộ test bao phủ 10 endpoint, mỗi endpoint có tình huống hợp lệ, lỗi yêu cầu (400) và lỗi schema (422). GitHub Actions chạy cùng lệnh khi push/pull request.

## Hiệu năng đã đo trên backend deploy

Đo ngày **30/09/2026** bằng Locust 2.46.6 tới Render, 1 người dùng đồng thời, ảnh hoa hồng mẫu, 102 request phân loại: 0 lỗi. Phần cứng của dịch vụ là Render Free tại Singapore, giới hạn **0,15 CPU và 512 MB RAM**. Log ứng dụng ghi process peak RSS **423,3 MB** khi classifier đã nạp (`API_PERF`, Python `resource.getrusage`; đây là RSS cực đại của process, không phải biểu đồ RAM toàn container của Render). Kết quả p50/p95 tính từ thời gian phản hồi HTTP:

| Endpoint | Số request | Lỗi | p50 | p95 | Trung bình | Process peak RSS |
|---|---:|---:|---:|---:|---:|---:|
| `POST /api/classify` | 102 | 0 | 3,90 s | 4,50 s | 3,87 s | 423,3 MB |
| `POST /api/detect` | 51 | 0 | 38,74 s | 55,45 s | 43,52 s | 506,2 MB |

Detector được đo bằng Locust 2.46.6 trong ba lượt một người dùng, cùng ảnh hoa hồng; tổng cộng 51 request, 0 lỗi. p50/p95 trong bảng được tính theo nearest-rank từ 51 độ trễ được tái dựng từ cumulative response-time history của Locust. Chi tiết từng request ở [`reports/render-detect_samples.csv`](reports/render-detect_samples.csv), tổng hợp ba lượt ở [`reports/render-detect_runs.csv`](reports/render-detect_runs.csv), và số liệu gộp ở [`reports/render-detect_stats.csv`](reports/render-detect_stats.csv). Đây là phép đo đơn người dùng trên gói CPU miễn phí, không đại diện tải đồng thời cao. Có một lần cold start 130,27 giây; p95 toàn mẫu là 55,45 giây. Process peak RSS cao nhất ghi trong log Render là 506,2 MB trên giới hạn container 512 MB. Kết quả OOM của Album hoa thuộc bản CLIP ViT-B/32 cũ. Encoder MobileCLIP2 mới đã qua truy vấn hoa hồng cục bộ (top-5 cùng nhãn) trên index 1.236 ảnh; cần deploy commit mới và benchmark live trước khi kết luận đã hết OOM. `POST /api/chat/sync` hiện trả 503 vì Render chưa được cấu hình `GOOGLE_API_KEY`; log ghi rõ `Thiếu GOOGLE_API_KEY (hoặc GEMINI_API_KEY) để dùng Gemini.` Retriever chatbot đã chuyển sang BM25 để tránh nạp thêm MiniLM, nhưng chưa thể đo response thành công cho đến khi thêm secret Gemini vào Render.

Có thể chạy lại bằng `python -m pip install -r requirements-benchmark.txt`, đặt `FLOWER_TEST_IMAGE` trỏ tới ảnh hoa rồi chọn task Locust cần đo bằng `--tags classify`, `--tags detect`, `--tags search-image` hoặc `--tags chat`.

Các checkpoint và FAISS index cần cho demo được theo dõi bằng Git LFS (xem `.gitattributes`); ảnh gốc và cache Hugging Face không nằm trong repo. Nếu clone thủ công cần tải đầy đủ LFS objects, chạy `git lfs pull`. Dockerfile đóng gói `artifacts/` và `data/` vào image.

## Docker

Image dùng cổng 7860. Chạy `python scripts/prepare_flowers102.py --epochs 3` trước khi build để Docker nhận dataset hoa, checkpoint phân loại và chỉ mục tìm kiếm, sau đó:

```bash
docker build -t tkw-nhom10 .
docker run --rm -p 7860:7860 tkw-nhom10
```
