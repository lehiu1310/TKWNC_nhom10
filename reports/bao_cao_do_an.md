# Báo cáo đồ án — Vườn Hoa AI

**Môn học:** Lập trình Web nâng cao  
**Nhóm:** TKWNC — Nhóm 10  
**Ngày cập nhật số liệu:** 23/10/2026  
**Demo:** https://tkwnc-nhom10.vercel.app/  
**AI backend:** https://tkw-nhom10-api.onrender.com  
**Mã nguồn hiện tại:** https://github.com/lehiu1310/TKWNC_nhom10/tree/main  
**Bản giao diện đã kiểm tra live:** `f09212677d4e9723de2d9f89f526d21ca0c7d5b3`  
**Bản backend Render đang chạy:** `ec114f731cd1` (deploy `dep-dbd5kt6i0phs73es5v1g`, nhánh `feature-gift-advisor`)

## 1. Bài toán, người dùng và tóm tắt

Người mới tìm hiểu hoa thường phải tra nhiều nguồn để nhận biết tên, tìm ảnh tương tự và hiểu cách chăm sóc. Vườn Hoa AI gom các tác vụ đó vào một website tiếng Việt: tra cứu 103 loài hoa, phân loại ảnh, khoanh vùng hoa, tìm ảnh bằng ảnh/văn bản và hỏi đáp từ tài liệu về hoa. Người dùng mục tiêu là người yêu hoa, người trồng hoa tại nhà và sinh viên cần một ví dụ tích hợp React, API, CSDL và AI.

Trang tặng hoa là tiện ích quy tắc và dữ liệu, không được quảng bá như một mô hình AI. Người có tài khoản có thể đồng bộ Sổ hoa và Cây của tôi; người chưa đăng nhập vẫn dùng được các chức năng tra cứu/AI chính. Website chạy bằng React function components và Hooks. Vercel có API gateway Node.js/Express 5 cho route tài khoản; API AI chạy bằng FastAPI trên Render, phục vụ JSON/REST và chat dạng SSE.

**Tóm tắt kết quả:** website React, Express gateway và FastAPI AI đã deploy; bốn luồng AI, đăng nhập trên giao diện và dữ liệu tài khoản dùng Neon PostgreSQL đã có bằng chứng production. Vercel rewrite route auth/account tới Express gateway và route AI tới FastAPI Render. Gateway có đường ghi PostgreSQL trực tiếp nếu cấu hình `DATABASE_URL`; khi không có, nó chuyển tiếp route tài khoản tới FastAPI trên Render. Bằng chứng hiện có xác nhận Render đang dùng PostgreSQL, nhưng chưa xác nhận Vercel đã cấu hình đường DB trực tiếp. Cùng origin giúp trình duyệt gửi cookie phiên `SameSite=Lax`. Các kết quả mô hình có giao thức và giới hạn rõ; đây không phải cam kết độ chính xác cho mọi ảnh/loài.

## 2. Kiến trúc, API và kịch bản demo

```text
Trình duyệt React/Vite (Vercel)
        │ Vercel same-origin rewrites
        ├─ /api/auth/*, /api/account/data/* → Node.js / Express 5 gateway
        │                                      └─ proxy account routes to Render
        └─ route AI + account proxy → FastAPI (Docker / Render) → Neon PostgreSQL
                 ├─ ResNet-18 → phân loại 103 nhãn
                 ├─ YOLO11n → phát hiện 4 lớp hoa
                 ├─ ResNet-18 feature index → tìm ảnh (production Free tier)
                 └─ BM25 + kho tài liệu → RAG tiếng Việt
```

Frontend upload ảnh hoặc gửi truy vấn; Vercel rewrite định tuyến cùng origin. Express gateway xử lý route tài khoản và cookie phiên; trong cấu hình production hiện được ghi nhận, gateway chuyển tiếp tài khoản sang FastAPI Render. FastAPI kiểm tra schema/loại file, gọi dịch vụ AI hoặc kho tài khoản PostgreSQL rồi trả kết quả để React hiển thị loading, kết quả hoặc lỗi. Trên Render Free, model được nạp theo nhu cầu và nhả model khác khi cần giới hạn RAM; `ready=true` cho biết các route model đã bật, còn `model_states` thể hiện model nào đang cư trú tại thời điểm kiểm tra.

| API chính | Mục đích |
|---|---|
| `GET /api/health`, `GET /api/startup` | Sức khỏe và sẵn sàng của backend |
| `GET /api/species`, `GET /api/species/{id}/image` | Danh mục, ảnh loài |
| `POST /api/classify`, `POST /api/detect` | Phân loại và khoanh vùng ảnh |
| `POST /api/search/text`, `/api/search/image` | Tìm ảnh theo mô tả hoặc ảnh truy vấn |
| `POST /api/ask`, `/api/chat`, `/api/chat/sync` | Hỏi đáp RAG; chat SSE hoặc đồng bộ |
| `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me` | Tài khoản và phiên đăng nhập |
| `GET/PUT /api/account/data/garden` và `/api/account/data/giftbook` | Đọc/ghi dữ liệu cá nhân |
| `POST /api/gifts/recommend`, `POST /api/gifts/greeting` | Gợi ý bó hoa theo luật; lời chúc AI tùy cấu hình |

### Mô hình dữ liệu tài khoản

| Bảng | Trường chính | Quan hệ / mục đích |
|---|---|---|
| `users` | `id`, `email`, `display_name`, `password_hash`, `password_salt`, `created_at` | Tài khoản; email duy nhất |
| `sessions` | `token_hash`, `user_id`, `expires_at` | Nhiều phiên cho một user; logout xóa phiên, xóa user xóa phiên |
| `user_data` | `user_id`, `data_key`, `payload`, `updated_at` | JSON cho `garden` hoặc `giftbook`; khóa chính ghép `user_id` + `data_key` |

Local/Compose dùng SQLite; production API tài khoản trên Render dùng Neon PostgreSQL với cùng ba bảng. Express gateway có adapter PostgreSQL trực tiếp tùy chọn, nhưng chưa tính đường này là production đã xác minh. Danh mục hoa, ảnh và tri thức AI là dữ liệu tĩnh/asset trong ứng dụng, không lưu chung trong bảng tài khoản.

### Chạy thử và trình bày

README có lệnh Docker Compose để dựng app bằng một lệnh: `docker compose -f compose.yaml up --build`. Nếu Git LFS chưa tự tải checkpoint sau khi clone, cần chạy `git lfs pull` một lần trước khi build. Ngày 23/10, checkout sạch `46ab88a` đã build và chạy Compose; cả năm route AI (classify, detect, tìm ảnh, tìm mô tả tiếng Việt và RAG chat) trả HTTP 200 với ảnh mẫu. `ENABLE_GEMINI_API=0`; lượt kiểm tra không gọi API trả phí. Đây là smoke test chức năng, không phải benchmark. Cấu hình có `.env.example`, health check và dữ liệu mẫu; tài khoản demo ở phần 4. Kịch bản trình bày 10 phút: bài toán/người dùng; sơ đồ React/Vercel → Express + FastAPI → Neon/model; demo luồng chính và lỗi chưa đăng nhập; trích đoạn code xử lý RAM; metric, bảo mật và hạn chế. Video dự phòng đã quay, thời lượng metadata 4 phút 31 giây, lưu tại `output/video/demo-vuon-hoa-ai.webm`; cần chép lên máy trình bày và mở được khi mất mạng.

## 3. Dữ liệu, kết quả AI và giới hạn

| Thành phần | Dữ liệu và phép đo | Kết quả |
|---|---|---|
| ResNet-18 | 11.859 ảnh, 103 lớp; split stratified `random_state=42`, 2.135 ảnh validation | Accuracy **90,26%**; macro-F1 **91,56%**; weighted-F1 **90,24%** |
| YOLO11n fine-tuned | 831 ảnh, 1.280 bounding box, 4 lớp; train/val/test = 664/83/84 ảnh; 12 epoch, 320 px | mAP50 **0,8704**; mAP50–95 **0,6802**; precision **0,8104**; recall **0,8199** |
| ResNet-18 features + lọc theo lớp dự đoán (production) | Index 1.236 ảnh; 206 query held-out theo đường dẫn, cùng nguồn ảnh | Precision@5 **0,9165**; xếp hạng toàn cục **0,8757** |
| MobileCLIP2-S0 + FAISS (benchmark, không dùng trên Render Free) | Index 1.236 ảnh; 206 query held-out theo đường dẫn, cùng nguồn ảnh | Precision@5 **0,8592** |
| BM25 retrieval và câu trả lời dự phòng cho RAG | 11 nguồn tài liệu, 31 câu hỏi do nhóm biên soạn | Hit@3 **31/31 (100%)**; câu trả lời dự phòng không rỗng và dẫn đúng tệp nguồn mong đợi **31/31 (100%)** |
| Tìm kiếm mô tả tiếng Việt, fallback offline | 10 prompt thủ công, 5 lớp hoa nổi bật; mở rộng dấu hiệu hình thái rồi đo CLIP trên toàn index | Precision@5 **0,32**, tăng từ 0,24; cue đúng nhóm **8/8** trường hợp có hint (coverage 8/10) |

Các phép đo classifier và retrieval cùng nguồn dữ liệu với quá trình phát triển, nên không khẳng định khả năng tổng quát trên mọi ảnh thực tế. Classifier validation cũng được dùng khi chọn checkpoint, không phải tập test độc lập. Detector có test split riêng nhưng chỉ 4 lớp và 84 ảnh. Bộ RAG do nhóm biên soạn; Hit@3 đo tệp nguồn trong top 3, còn kiểm tra câu trả lời dự phòng chỉ xác nhận có câu trả lời và dẫn đúng tệp mong đợi, không đánh giá tính đúng sự thật, đầy đủ hay chất lượng diễn đạt. Mỗi báo cáo gốc và hướng dẫn tái tạo được liệt kê trong README, thư mục `reports/` và `scripts/`.

### Giới hạn và hướng phát triển

Classifier luôn trả nhãn từ 103 lớp; ảnh ngoài miền có thể bị gán nhầm. Ngưỡng từ chối chọn trên 10 ảnh hoa và 10 ảnh không hoa nên còn nhỏ. Detector mới nhận biết Daisy, dandelion, roses và sunflowers; chưa có lớp tulip. Tìm kiếm mô tả offline đạt P@5 0,32 trên 10 câu thủ công; hint gợi ý đúng nhóm ở 8/8 câu có hint (coverage 8/10). Đây là bộ nhỏ do nhóm viết, chưa độc lập, nên độ tổng quát của phép đo chưa được chứng minh. Benchmark truy xuất theo ảnh đạt Precision@5 0,9165 sau khi lọc gallery theo lớp dự đoán; smoke test production mới trả 5/5 ảnh cùng loài cho ảnh mẫu hướng dương. RAG có 11 nguồn; Hit@3 đo truy xuất nguồn nhưng chưa chấm tính đúng sự thật của câu trả lời sinh; một số tài liệu ngắn, nguồn vùng miền/mùa hoa có giới hạn. Render Free có ít RAM/CPU và có thể khởi động nguội. Hướng tiếp theo: bộ test độc lập lớn hơn, mở rộng nhãn detector/tài liệu RAG, đo tải nhiều người và xác minh lại kết quả trên nhiều thiết bị.

Không dùng đầu ra AI cho quyết định y tế, ăn/uống, độc tính hoặc canh tác có hậu quả cao. Ảnh upload được gửi tới backend. Gemini Flash được cấu hình trên Free Tier; Render Logs có cả lượt trả HTTP 200 và một lỗi 503 được fallback RAG. Google AI Studio hiện hiển thị Free tier và chưa cài đặt billing cho project. Nếu hết quota hoặc provider lỗi, chat dùng RAG offline có trích dẫn.

## 4. Kiểm thử, bảo mật và production

GitHub Actions của main tại commit code `ec114f7` hoàn tất xanh (run 147): backend/API tests, frontend tests + production build và security audit; bằng chứng CI ghi nhận backend **107 passed, 1 skipped** và frontend **24 passed**. Các commit tài liệu/bằng chứng kế tiếp `46ab88a`, `26e06f4` và `fda2780` cũng có CI xanh ở các run **39840566782**, **39915100617** và **39915713239**. Các URL run lần lượt là https://github.com/lehiu1310/TKWNC_nhom10/actions/runs/39840566782, https://github.com/lehiu1310/TKWNC_nhom10/actions/runs/39915100617 và https://github.com/lehiu1310/TKWNC_nhom10/actions/runs/39915713239; cả ba đều xanh ở `pytest`, `web-build-and-tests` và `security-audit`. Các commit sau chỉ cập nhật tài liệu/bằng chứng, không đổi code backend/deploy. CI có PostgreSQL 16 integration, kiểm tra cách ly dữ liệu giữa hai tài khoản, quét secret trong lịch sử Git và audit dependency production; local PostgreSQL test skip khi không có `TEST_DATABASE_URL`. Docker Compose đã được cấu hình cho full stack và `docker compose config` hợp lệ; ngày 23/10, Compose từ checkout sạch trả HTTP 200 ở cả năm route AI, không bật Gemini.

Mật khẩu được băm scrypt với salt; cookie phiên HttpOnly, SameSite=Lax; API từ chối truy cập dữ liệu tài khoản khi chưa đăng nhập. Input có giới hạn schema/kích thước, lỗi validation và lỗi server được chuẩn hóa; secrets chỉ nằm trong biến môi trường. File .env không được theo dõi trong Git, repo có .env.example. Kiểm tra public: đọc dữ liệu garden khi chưa đăng nhập trả **401**; ID loài không tồn tại trả **404**; limit=0 trả **400**. CORS preflight từ origin Vercel được cấu hình giới hạn theo origin.

Production API tài khoản trên Render dùng Neon PostgreSQL cho tài khoản, phiên đăng nhập và dữ liệu vườn/quà. Smoke test ngày 23/10 qua Vercel same-origin xác nhận login, `/api/auth/me`, đọc garden/giftbook, logout và 401 khi chưa đăng nhập. Smoke test xác nhận luồng qua gateway hoạt động nhưng không phân biệt Express dùng kết nối Neon trực tiếp hay proxy fallback tới Render. Adapter PostgreSQL trực tiếp trong gateway cần `DATABASE_URL` riêng tại Vercel; chưa tính đường này là production đã hoàn tất. Tài khoản demo cùng mật khẩu được ghi trong README để giảng viên thử; không dùng tài khoản demo cho dữ liệu riêng. Không ghi connection string hoặc mật khẩu CSDL vào báo cáo.

### Deploy và kiểm tra production

Render MCP xác nhận service `tkw-nhom10-api` đang Live, gói Free, nhánh `feature-gift-advisor`, revision `ec114f731cd1`, deploy `dep-dbd5kt6i0phs73es5v1g`. Kiểm tra live ngày 23/10: Vercel, `/api/health`, `/api/startup` và `/api/species?limit=103` đều trả 200; health báo `ready=true`, `account_database=postgresql`, danh mục có 103 loài. Tại lần kiểm tra đó 0 model ở trạng thái resident, phù hợp với nạp theo nhu cầu; health không tự chứng minh inference đã nạp model. Smoke inference mới nhất chạy trực tiếp qua Vercel same-origin trên revision `ec114f731cd1` và cả năm route đều trả HTTP 200.

Smoke test qua origin production ngày 23/10/2026, dùng ảnh mẫu hướng dương trên backend hiện Live `ec114f731cd1`, cho kết quả:

- /api/classify: HTTP 200; top-1 sunflowers; 26,26 giây.
- /api/detect: HTTP 200; phát hiện 3 vùng sunflowers; 41,75 giây.
- /api/search/image: HTTP 200; top 5 đều sunflowers; 32,09 giây.
- /api/search/text: HTTP 200; mô tả tiếng Việt “đóa vàng lớn với tâm nâu tròn, cánh xếp tỏa ra ngoài” trả 5/5 sunflowers; 0,59 giây.
- /api/chat/sync: HTTP 200; trả câu trả lời có 3 nguồn trong 45,65 giây. API response không nêu provider; Render Logs ghi nhận request tới Gemini Flash trả HTTP 200 đúng thời điểm này.

Đây là smoke test một yêu cầu cho mỗi route, không phải benchmark tải hoặc kiểm định độc lập. Thời gian gồm ảnh hưởng cold start/model eviction trên Render Free. Cùng ảnh và truy vấn được dùng để so sánh đường API; không khẳng định độ chính xác tổng quát. Render Logs lúc 10:21:51 ngày 23/10 ghi nhận service gọi Gemini Flash và Google trả HTTP 200 cùng thời điểm route chat trả 200, có 3 nguồn. Google AI Studio khi kiểm tra hiển thị Free tier và chưa cài đặt billing cho project; một lần gọi không đảm bảo quota hoặc khả dụng trong tương lai. Khi provider lỗi/quota, ứng dụng fallback sang RAG offline có trích dẫn. Mô tả tiếng Việt đã kiểm chứng; không dùng smoke test này để khẳng định tìm kiếm câu tiếng Anh chính xác.
## 5. Phân công, công cụ hỗ trợ và xác nhận

| Thành viên (mã SV) | Phần việc chính | Tỷ lệ tự đánh giá | Xác nhận |
|---|---|---:|---|
| Nguyễn Hữu Lê Hiếu (23010895) |  |  |  |
| Phạm Văn Huấn (23010331) |  |  |  |
| Đào Duy Đông (24100085) |  |  |  |
| **Tổng** |  | **(điền tổng 100%)** |  |

Tên và mã sinh viên đã được điền theo thông tin nhóm cung cấp. Nhóm cần bổ sung phần việc thực tế, phân bổ tỷ lệ có tổng 100%, rồi từng thành viên ký xác nhận trước khi nộp. Không thể suy đoán đóng góp hoặc tạo commit giả danh thành viên; tài liệu hiện vẫn là bản nháp.


### Khai báo công cụ AI

Trong quá trình phát triển và chuẩn bị tài liệu, nhóm sử dụng OpenAI Codex/ChatGPT để hỗ trợ đọc code, truy vết lỗi, đề xuất chỉnh sửa và soạn nội dung. Các thay đổi được kiểm tra bằng test, CI hoặc smoke test production; nhóm chịu trách nhiệm giải thích và xác nhận phần việc mình nộp.

### Nguồn kiểm chứng trong repository

`reports/classifier_evaluation.json`, `reports/detector_evaluation.json`, `reports/classifier_retrieval_precision_at_5.json`, `reports/rag_hit_at_3.json`, `reports/vietnamese_search_offline_precision_at5.json`, `reports/current-production-ai-smoke-live-2026-10-23.json`, `reports/current-production-auth-smoke-2026-10-23.json`, `reports/current-production-health-2026-10-23.json`, `reports/current-render-deploy-2026-10-23.json`, `reports/current-clean-checkout-compose-ai-smoke-2026-10-23.json`, `tests/`, `.github/workflows/`, `README.md`. Bằng chứng riêng cho lượt Gemini HTTP 200 và trạng thái Free tier/no billing setup tại thời điểm kiểm tra: `reports/current-production-gemini-free-tier-2026-10-23.json` trong repository và `Bang-chung-Gemini-free-tier-2026-10-23-1021.json` trong gói nháp.
