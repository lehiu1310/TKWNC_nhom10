# Model Card — Vườn Hoa AI

## 1. Dữ liệu

Ứng dụng hiện phân loại ảnh trên **103 nhãn** của bộ Oxford Flowers 102 kết hợp TF Flowers, tổng cộng **11.859 ảnh** theo thống kê trong workspace. Phân bố không đồng đều: 76 nhãn có dưới 100 ảnh; số ảnh thấp nhất là 40. Năm loài được giới thiệu nổi bật trên giao diện là tập con của bộ phân loại: cúc (daisy) 700, bồ công anh 947, hoa hồng (roses) 761, hướng dương 792 và tulip 799 ảnh theo thống kê hiện có. Nguồn là hai bộ dữ liệu công khai trên; cần giữ điều khoản/ghi công của từng bộ khi phân phối.

Detector được fine-tune từ YOLO11n trên 831 ảnh có bounding box (1.280 hộp, 4 nhãn: daisy, dandelion, roses, sunflowers) từ bộ công khai [Weirdo-329/flower-detection-dataset](https://huggingface.co/datasets/Weirdo-329/flower-detection-dataset), giấy phép Apache-2.0 theo dataset card. Chia ngẫu nhiên cố định seed 42: 664 train, 83 validation, 84 test; train 3 epoch ở kích thước 320 trên CPU. Dataset gốc và split tái tạo không được commit vào repo; script tải/chuyển đổi và báo cáo nguồn/số lượng được lưu trong `scripts/prepare_flower_detection.py` và `data/detection_flowers_yolo/dataset_report.json` (thư mục dữ liệu đã chuyển đổi nằm trong `.gitignore`).

Kho tìm kiếm có 1.236 ảnh đã lập chỉ mục trong workspace. RAG có 8 tệp Markdown tiếng Việt trong `data/kb/`, dùng BM25 kèm lexical rerank và chunk overlap tối đa 100 ký tự; kho hiện chưa phải bộ tài liệu thật ≥20 trang. Bộ câu hỏi Hit@3 có 30 câu do nhóm biên soạn.

## 2. Chỉ số đã đo

| Thành phần | Chỉ số | Kết quả | Bằng chứng / giới hạn |
|---|---|---:|---|
| Bộ phân loại | Accuracy validation | 0,9026 (90,26%) | Tái đánh giá checkpoint trên đúng split 2.135 ảnh/103 lớp, khớp `artifacts/classifier/metrics.json`; cùng validation split đã dùng chọn checkpoint, không phải test độc lập. Báo cáo: [`reports/classifier_evaluation.json`](reports/classifier_evaluation.json). |
| Bộ phân loại | Macro-F1 / weighted-F1 | 0,9156 / 0,9024 | Cùng split validation, 2.135 ảnh; confusion matrix: [`reports/classifier_confusion_matrix.csv`](reports/classifier_confusion_matrix.csv). |
| Detector | mAP50 / mAP50-95 | 0,7306 / 0,5236 | Fine-tune 3 epoch, 320px; đánh giá trên 84 ảnh test tách riêng, 145 instances, CPU Intel Core i5-13500H 13th Gen. Báo cáo [`reports/detector_evaluation.json`](reports/detector_evaluation.json). |
| Detector | Precision / Recall | 0,6641 / 0,7411 | Cùng test split 84 ảnh; chi tiết split và license tại [`data/detection_flowers_yolo/dataset_report.json`](data/detection_flowers_yolo/dataset_report.json). |
| Tìm ảnh | Precision@5 | 0,8592 | 206 query held-out theo đường dẫn (2 ảnh × 103 lớp), không có query nào nằm trong FAISS index; relevance là cùng `species_id`. Cùng các nguồn Flowers dùng huấn luyện/index nên chưa phải đánh giá ngoài phân phối. Báo cáo: [`reports/retrieval_precision_at_5.json`](reports/retrieval_precision_at_5.json). |
| RAG | Hit@3 (đúng tệp nguồn trong top 3) | 0,9667 (29/30) | Bộ câu hỏi nội bộ [`data/kb_eval/rag_hit_at_3.json`](data/kb_eval/rag_hit_at_3.json); kết quả [`reports/rag_hit_at_3.json`](reports/rag_hit_at_3.json). Chỉ đo truy xuất nguồn, chưa chấm tính đúng của câu trả lời Gemini. Kho tri thức hiện có 8 tài liệu Markdown ngắn, chưa đạt điều kiện ≥20 trang. |
| API phân loại | p50 / p95 | 3,90 s / 4,50 s | Locust 2.46.6, 102 request, 1 người dùng đồng thời tới Render Free ngày 30/09/2026; 0 lỗi. CSV: [`reports/render-classify_stats.csv`](reports/render-classify_stats.csv). |
| API phân loại | Process peak RSS | 423,3 MB | Dòng `API_PERF` trong log Render sau khi nạp classifier; RSS cực đại process, không phải RAM toàn container. Instance giới hạn 512 MB. |
| API phát hiện | p50 / p95 | 38,74 s / 55,45 s | Locust 2.46.6, 51 request qua ba lượt một người dùng, 0 lỗi; nearest-rank tính từ history tích lũy của Locust. Chi tiết từng mẫu: [`reports/render-detect_samples.csv`](reports/render-detect_samples.csv); tổng hợp lượt: [`reports/render-detect_runs.csv`](reports/render-detect_runs.csv). |
| API phát hiện | Process peak RSS | 506,2 MB | Cao nhất trong log `API_PERF` Render khi classifier và YOLO cùng nạp; giới hạn container Render Free 512 MB. Sau lần khởi động lại, riêng detector ghi 457,1 MB. |
| API tìm ảnh | Độ trễ / lỗi | Chưa đo được trên bản deploy mới | Bản deploy cũ dùng CLIP ViT-B/32 và OOM trên Render Free (512 MB). Mã hiện tại dùng MobileCLIP2-S0 half precision; index 1.236 ảnh; truy vấn cục bộ bằng ảnh hoa hồng trả top-5 cùng nhãn. Cần deploy và đo live trước khi kết luận hết OOM. |
| API chatbot | Độ trễ / lỗi | Chưa đo được | Một request `POST /api/chat/sync` trả 503 vì Render chưa có `GOOGLE_API_KEY`; log xác nhận `Thiếu GOOGLE_API_KEY (hoặc GEMINI_API_KEY) để dùng Gemini.` Chưa có mẫu thành công; cần thêm key vào Render Secret rồi benchmark. |

## 3. Giới hạn

- Bộ phân loại chỉ học các nhãn trong 103 lớp; năm loài trên giao diện không đại diện cho toàn bộ phạm vi. Ảnh ngoài phân phối vẫn có thể bị gán nhãn gần nhất.
- Detector YOLO11n hiện được fine-tune cho bốn nhóm daisy, dandelion, roses và sunflowers; chưa có lớp tulip. mAP50 đo trên test split cùng nguồn bộ dữ liệu, chưa chứng minh khả năng ngoài phân phối. Huấn luyện ngắn 3 epoch và test 84 ảnh nên kết quả còn hạn chế; ảnh thử thật cũng có thể xuất hiện hộp nhầm.
- MobileCLIP2-S0 + FAISS trả ảnh tương tự trong index 1.236 ảnh, không xác nhận danh tính thực vật. Truy vấn chữ tiếng Việt được dịch sang tiếng Anh bằng Helsinki-NLP opus-mt-vi-en trước khi mã hóa. Precision@5 được đo trên ảnh cùng nguồn dataset, chưa chứng minh khả năng tìm ảnh từ miền dữ liệu khác.
- RAG giới hạn bởi 8 tệp tri thức và xếp hạng từ khóa BM25; câu hỏi dùng cách diễn đạt xa nội dung tài liệu có thể không truy xuất đúng đoạn. Gemini sinh câu trả lời dựa trên ngữ cảnh truy xuất nhưng không đảm bảo mọi câu đều chính xác.
- Đo thành công trên dịch vụ hiện có classifier (102 request) và detector (51 request). Encoder MobileCLIP2 + index mới đã qua kiểm tra API cục bộ và đạt Precision@5 0,8592 trên 206 ảnh held-out cùng dataset; bản mới chưa deploy/benchmark trên Render. Chatbot chưa có khóa Gemini ở Render. Cold start detector có thể mất hơn 2 phút.

## 4. Rủi ro

- Dự đoán sai có thể gây nhầm lẫn khi nhận dạng cây; không dùng kết quả làm tư vấn y tế, ăn/uống, độc tính hoặc chăm sóc nông nghiệp có hậu quả cao.
- Ảnh mờ, nhiều hoa, nền phức tạp, góc chụp khác dữ liệu và loài ngoài nhãn làm tăng nguy cơ sai.
- Ảnh tải lên được gửi tới backend. Khi chatbot dùng Gemini, câu hỏi và đoạn tri thức truy xuất được gửi đến Google Gemini API. Không gửi khóa API từ trình duyệt hoặc lưu khóa trong kho mã.
- Chưa có bộ kiểm thử prompt-injection chuyên biệt.

## 5. Cách dùng đúng / sai

**Nên:** tải ảnh rõ, đủ sáng, chủ thể chiếm phần lớn khung hình; xem top-k như gợi ý; kiểm tra nguồn RAG; xác minh thông tin quan trọng bằng nguồn thực vật học đáng tin cậy.

**Không nên:** coi confidence là xác suất đã hiệu chuẩn; kết luận loài ngoài 103 nhãn bằng top-1; dùng detector COCO để khẳng định hoa không tồn tại; xem chatbot là nguồn chuyên môn cuối cùng.

## Cấu hình chatbot

Provider mặc định là Gemini (`LLM_PROVIDER=gemini`, model được cấu hình qua `GEMINI_MODEL`). Cần đặt `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY` trong backend/secret của nền tảng deploy. Có thể chọn `LLM_PROVIDER=hf_local` để dùng Qwen cục bộ, cần tải trọng số lớn hơn. Không commit khóa API vào Git.

## So sánh nâng cao và giải thích

ResNet-18 được đối chiếu với MobileNetV3-Small trên cùng validation split 2.135 ảnh/103 lớp: lần lượt accuracy 90,26% và 65,90%; macro-F1 91,56% và 57,45%. Checkpoint lần lượt 44,995 MB và 6,627 MB; latency batch-1 PyTorch CPU p50/p95 69,18/75,20 ms và 17,90/20,20 ms trên Intel Core i5-13500H, PyTorch 2.14.0+cpu, 2 threads. MobileNet chỉ được fine-tune 3 epoch nên đây là một phép so sánh engineering, không phải hyperparameter search cân bằng. ONNX opset 17 cho ResNet có sai khác logits tối đa 5,61e-6 trên 64 ảnh; ONNX Runtime CPU p50/p95 73,06/77,70 ms trong lần đo cuối, không nhanh hơn PyTorch trên máy này. Báo cáo: `reports/classifier_architecture_comparison.json`.

API có tùy chọn Grad-CAM cho một ảnh; overlay ví dụ `reports/gradcam_rose_example.jpg`. Đây chỉ là heatmap xấp xỉ vùng ảnh ảnh hưởng tới điểm lớp, không xác thực độ đúng và chưa phải detector ảnh ngoài phân phối. Mã giải thích nằm ở `core/classifier.py`; `POST /api/classify` bật bằng field `explain=true`.
