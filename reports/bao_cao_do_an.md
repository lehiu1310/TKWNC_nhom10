# Báo cáo đồ án — Vườn Hoa AI

**Nhóm:** TKWNC nhóm 10  
**Phiên bản:** `v1.0`  
**Ngày chốt số liệu:** 01/10/2026  
**Demo:** https://tkwnc-nhom10.vercel.app/  
**Backend:** https://tkw-nhom10-api.onrender.com  
**Mã nguồn:** https://github.com/lehiu1310/TKWNC_nhom10/tree/v1.0

> Báo cáo cô đọng để dàn trang tối đa 8 trang A4. Số liệu chỉ ghi khi có file kết quả hoặc phép đo tương ứng trong repository. Backend Render hiện chưa được xác nhận chạy commit `v1.0`; trạng thái live được phân biệt riêng với kết quả local.

## 1. Bài toán và sản phẩm

Vườn Hoa AI là ứng dụng web cho phép người dùng khám phá hoa và thử bốn tác vụ AI: (1) phân loại ảnh hoa, (2) phát hiện/khoanh vùng đối tượng, (3) tìm ảnh tương tự từ ảnh hoặc văn bản, và (4) chatbot hỏi đáp dựa trên kho tri thức hoa. Giao diện React + Vite; backend FastAPI phục vụ cả web và Streamlit. Người dùng có thể mở demo công khai hoặc chạy web local kết nối backend đã deploy.

**Luồng tổng quát:** trình duyệt gửi ảnh/câu hỏi → FastAPI kiểm tra dữ liệu đầu vào → nạp mô hình theo nhu cầu → suy luận hoặc truy xuất → trả JSON/kết quả SSE → giao diện hiển thị kết quả, trạng thái tải và lỗi.

## 2. Dữ liệu và cách đánh giá

| Tác vụ | Dữ liệu | Cách chia/đánh giá |
|---|---|---|
| Phân loại | Oxford Flowers 102 kết hợp lớp tulip TF Flowers; 11.859 ảnh, 103 nhãn | Split stratified `random_state=42`, 2.135 ảnh validation. Đây là cùng giao thức validation dùng khi chọn checkpoint, không phải test độc lập. |
| Phát hiện | `Weirdo-329/flower-detection-dataset`, Apache-2.0; 831 ảnh, 1.280 hộp, 4 lớp | Seed 42: train 664, validation 83, test 84; YOLO11n fine-tune 3 epoch, imgsz 320. |
| Tìm ảnh | 1.236 ảnh trong FAISS index | 206 query held-out theo đường dẫn, 2 ảnh/lớp; relevance là cùng nhãn loài; Precision@5. Query cùng miền dữ liệu với index. |
| RAG | 8 tệp Markdown tiếng Việt; 30 câu hỏi do nhóm biên soạn | Hit@3 đo việc tệp nguồn kỳ vọng xuất hiện trong ba kết quả đầu, không đánh giá độ đúng câu trả lời sinh. |

Nguồn chi tiết, split và quy trình tái tạo: `scripts/prepare_flowers102.py`, `scripts/prepare_flower_detection.py`, `scripts/train_flower_detector.py`, `data/detection_flowers_yolo/dataset_report.json`, và `data/kb_eval/rag_hit_at_3.json`.

## 3. Mô hình và kết quả đo

| Thành phần | Kết quả | Diễn giải |
|---|---:|---|
| ResNet-18 | Accuracy 90,26%; macro-F1 91,56%; weighted-F1 90,24% | 2.135 ảnh validation, 103 lớp. Không xem đây là kết quả test độc lập. |
| YOLO11n hoa | mAP50 0,7306; mAP50–95 0,5236; precision 0,6641; recall 0,7411 | 84 ảnh test, 145 instances; 4 lớp daisy, dandelion, roses, sunflowers. Chưa có tulip. |
| MobileCLIP2-S0 + FAISS | Precision@5 0,8592 | 206 query held-out cùng nguồn Flowers; không chứng minh tổng quát sang ảnh ngoài miền. |
| BM25 cho RAG | Hit@3 29/30 = 96,67% | Chỉ đo truy xuất đúng tệp nguồn; kho tri thức chưa đủ 20 trang theo rubric. |

Bằng chứng số liệu: `reports/classifier_evaluation.json`, `reports/classifier_confusion_matrix.csv`, `reports/detector_evaluation.json`, `reports/retrieval_precision_at_5.json`, `reports/rag_hit_at_3.json`.

## 4. API, kiểm thử và hiệu năng

FastAPI cung cấp 10 endpoint: health, danh sách/ảnh loài, classify, detect, tìm kiếm văn bản/ảnh, gallery, chat SSE và chat đồng bộ. Kiểm tra hợp lệ/lỗi đầu vào nằm trong `tests/`; GitHub Actions chạy `python -m pytest -q`. Kết quả local gần nhất: **36 passed, 1 warning**. Run CI xanh trước đó: [GitHub Actions](https://github.com/lehiu1310/TKWNC_nhom10/actions).

Đo Locust đơn người dùng trên Render Free Singapore (giới hạn 0,15 CPU, 512 MB), ảnh hoa hồng:

| Endpoint (bản deploy được đo) | Request | Lỗi | p50 | p95 | RAM process peak |
|---|---:|---:|---:|---:|---:|
| `POST /api/classify` | 102 | 0 | 3,90 s | 4,50 s | 423,3 MB |
| `POST /api/detect` | 51 | 0 | 38,74 s | 55,45 s | 506,2 MB |

Đây là số đo trên bản deploy cũ, tải đồng thời một người; không đại diện tải lớn. Chưa có số đo thành công live mới cho search/chat. Chat Gemini từng trả 503 khi Render thiếu secret `GOOGLE_API_KEY`.

## 5. Kiến trúc triển khai và trạng thái live

- **Frontend:** Vercel, https://tkwnc-nhom10.vercel.app/ . Trang chủ đã được kiểm tra trả HTTP 200; chưa có xác nhận kiểm thử trực tiếp trên điện thoại.
- **Backend:** Render, https://tkw-nhom10-api.onrender.com . Kiểm tra `/api/health` trả `status: ok`.
- **Độ lệch phiên bản cần lưu ý:** lần gọi `/api/detect` live ngày 01/10/2026 với ảnh hoa hồng mất 73,51 giây và trả các nhãn COCO `vase`, `cup`, `potted plant`. Vì vậy dịch vụ live chưa xác nhận chạy detector hoa trong source `v1.0`. Mã local mặc định chọn `artifacts/detector/flower_yolo11n.pt`.
- Các checkpoint/index lớn được theo dõi bằng Git LFS. Dockerfile dùng cổng 7860; deploy đang dùng Render, không phải Hugging Face Spaces.

Để kiểm tra tình trạng hiện tại: `GET /api/health`; sau khi deploy đúng commit, gửi ảnh hoa hồng vào `POST /api/detect` và xác nhận nhãn `roses`, sau đó thử đủ classify, detect, search và chat. Không coi health xanh là bằng chứng các model đã nạp thành công.

## 6. Giao diện và trải nghiệm

React + Vite tổ chức landing page, Bách khoa 5 loài nổi bật và bốn panel AI. Giao diện có trạng thái chọn/tải ảnh, loading và lỗi; các thao tác AI gọi FastAPI. Bản demo Vercel trả HTTP 200 ở lần kiểm tra gần nhất. Cần quay demo trực tiếp ở thời điểm nộp để ghi lại trạng thái của backend thực tế, đặc biệt detector và Gemini.

## 7. Giới hạn, rủi ro và sử dụng có trách nhiệm

Classifier luôn chọn nhãn trong 103 lớp và có thể nhầm ảnh ngoài phân phối; confidence không phải xác suất đã hiệu chuẩn. Detector mới chỉ có bốn loài và kết quả test cùng nguồn dữ liệu; có thể xuất hiện false positive, gồm một ca ảnh hoa hồng có thêm hộp `daisy`. Retrieval chỉ tìm trong 1.236 ảnh index. RAG chỉ có tám tài liệu ngắn và BM25 có thể bỏ sót câu hỏi diễn đạt khác; kết quả Hit@3 không xác nhận câu trả lời đúng. Không dùng kết quả để quyết định ăn/uống, độc tính, y tế hay canh tác có hậu quả cao. Ảnh tải lên được gửi backend; chatbot Gemini gửi câu hỏi và đoạn ngữ cảnh tới Google API. API key chỉ cấu hình ở secret môi trường, không đưa lên frontend/repository.

## 8. Cách chạy và nguồn kiểm chứng

Đường chạy nhanh và cài đặt local có trong `README.md`. Bốn chức năng cần backend và model/dependency tương ứng; lần chạy đầu có thể cần Internet tải trọng số. Chạy kiểm thử: `python -m pip install -r requirements-test.txt` rồi `python -m pytest -q`. Build giao diện: trong `web/`, chạy `corepack pnpm install --frozen-lockfile` và `corepack pnpm build`.

Tệp kết quả và cấu hình được dẫn trực tiếp trong báo cáo; các số liệu không có file đo hoặc log kiểm chứng không được suy diễn thành kết quả đã đạt.
