# Vườn Hoa AI

## Mở sản phẩm và tài liệu demo

- **Website:** https://tkwnc-nhom10.vercel.app/
- **API health:** https://tkw-nhom10-api.onrender.com/api/health
- **Tài khoản demo và hướng dẫn:** [DEMO.md](DEMO.md)
- **Video demo dự phòng (4 phút 31 giây):** [Mở video](Video-demo-offline.webm)

---

Ứng dụng React tra cứu 103 loài hoa, có API cho phân loại ảnh, phát hiện hoa, tìm kiếm và hỏi đáp tài liệu. Giao diện React/Vite gọi REST API; backend gồm Express cho gateway/tài khoản và FastAPI cho các chức năng AI.

## Thành phần chính

- `web/`: giao diện React và các bài kiểm tra frontend.
- `api/`: Express gateway và FastAPI REST API.
- `core/`: xử lý classifier, detector, retrieval và chatbot RAG.
- `data/`: dữ liệu loài hoa, ảnh mẫu và tài liệu nguồn cần thiết cho ứng dụng.
- `artifacts/`: trọng số và index mô hình cần thiết; các tệp lớn được quản lý bằng Git LFS.
- `tests/`: kiểm thử API, xử lý AI và gateway.

## Chạy nhanh bằng Docker Compose

Cần Docker Desktop và Git LFS. Sau khi clone:

```powershell
git lfs install
git lfs pull
docker compose -f compose.yaml up --build
```

Mở `http://localhost:7860`. Compose lưu dữ liệu SQLite trong volume `vuonhoa-data` để dữ liệu còn sau khi container khởi động lại.

## Chạy frontend và API trực tiếp trên Windows

Cần Python 3.11 và Node.js 20.19 trở lên. Tạo môi trường Python và cài dependency:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
corepack pnpm --dir web install --frozen-lockfile
git lfs pull
```

Khởi động bằng một lệnh:

```powershell
.\scripts\start_local.ps1
```

Giao diện chạy tại `http://localhost:5173`, API tại `http://127.0.0.1:8000`. Trạng thái API: `GET /api/health`.

## API

- `GET /api/health`, `GET /api/startup`: trạng thái dịch vụ.
- `GET /api/species`: danh mục loài hoa.
- `POST /api/classify`: phân loại ảnh.
- `POST /api/detect`: phát hiện hoa trong ảnh.
- `POST /api/search/text`, `POST /api/search/image`: tìm kiếm hoa.
- `POST /api/chat`, `POST /api/chat/sync`: hỏi đáp RAG.
- `/api/auth/*` và `/api/account/data/*`: đăng ký, đăng nhập và dữ liệu tài khoản.

## Cấu hình

SQLite là mặc định cho chạy local và Docker Compose. Có thể đặt `DATABASE_URL` trong file `.env` để dùng PostgreSQL; không đưa `.env` hoặc khóa API lên GitHub. Gemini mặc định tắt ở local. Chỉ bật bằng `ENABLE_GEMINI_API=1` và cấu hình `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY` khi cần. File `.env.example` liệt kê các biến cấu hình mà không chứa secret.

Frontend nhận `VITE_API_BASE_URL` hoặc `VITE_API_URL`; nếu để trống, Vite proxy API tới cổng 8000.

## Kiểm thử và build

Backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend:

```powershell
cd web
pnpm test
pnpm build
```

GitHub Actions chạy kiểm thử backend, frontend và production build khi có push hoặc pull request.
