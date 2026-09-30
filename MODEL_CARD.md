# Model Card — Vườn Hoa AI

## 1. Dữ liệu

Ứng dụng hiện phân loại ảnh trên **103 nhãn** của bộ Oxford Flowers 102 kết hợp TF Flowers, tổng cộng **11.859 ảnh** theo thống kê trong workspace. Phân bố không đồng đều: 76 nhãn có dưới 100 ảnh; số ảnh thấp nhất là 40. Năm loài được giới thiệu nổi bật trên giao diện là tập con của bộ phân loại: cúc (daisy) 700, bồ công anh 947, hoa hồng (roses) 761, hướng dương 792 và tulip 799 ảnh theo thống kê hiện có. Nguồn là hai bộ dữ liệu công khai trên; cần giữ điều khoản/ghi công của từng bộ khi phân phối.

Kho tìm kiếm có 1.236 ảnh đã lập chỉ mục trong workspace. RAG hiện có 8 tệp Markdown tiếng Việt trong `data/kb/`, chưa phải bộ tài liệu 20 trang hay tập đánh giá 30 câu.

## 2. Chỉ số đã đo

| Thành phần | Chỉ số | Kết quả | Bằng chứng / giới hạn |
|---|---|---:|---|
| Bộ phân loại | Accuracy validation | 0,9026 (90,26%) | Snapshot có thể xem trong [`reports/classifier_metrics.json`](reports/classifier_metrics.json), lấy từ artifact hiện có; 2.135 ảnh validation, 103 lớp, 3 epoch. Không phải phép đo độc lập mới. |
| Bộ phân loại | Macro-F1 / confusion matrix | Chưa đo được | Không có trong metrics artifact hiện có. |
| Detector | mAP50 | Chưa đo được | YOLO11n pretrained COCO; không có kết quả fine-tune trên bộ hoa riêng. |
| Tìm ảnh | Precision@5 | Chưa đo được | Có 1.236 ảnh trong index; chưa có ground-truth relevance set. |
| RAG | Hit@3 / độ đúng câu trả lời | Chưa đo được | Chưa có tập 30 câu hỏi với nguồn chuẩn. |
| API | p50 / p95 và RAM | Chưa đo được | Chưa benchmark trên backend deploy và chưa đo RAM thật. |

## 3. Giới hạn

- Bộ phân loại chỉ học các nhãn trong 103 lớp; năm loài trên giao diện không đại diện cho toàn bộ phạm vi. Ảnh ngoài phân phối vẫn có thể bị gán nhãn gần nhất.
- Detector YOLO11n pretrained COCO không có lớp hoa chuyên biệt; có thể không phát hiện hoa hoặc chỉ nhận diện vật thể nền thuộc COCO.
- CLIP/FAISS trả ảnh tương tự trong index, không xác nhận danh tính thực vật.
- RAG giới hạn bởi 8 tệp tri thức. Gemini sinh câu trả lời dựa trên ngữ cảnh truy xuất nhưng không đảm bảo mọi câu đều chính xác.
- Chưa có số liệu hiệu năng, độ trễ, RAM đáng tin cậy trên phần cứng deploy.

## 4. Rủi ro

- Dự đoán sai có thể gây nhầm lẫn khi nhận dạng cây; không dùng kết quả làm tư vấn y tế, ăn/uống, độc tính hoặc chăm sóc nông nghiệp có hậu quả cao.
- Ảnh mờ, nhiều hoa, nền phức tạp, góc chụp khác dữ liệu và loài ngoài nhãn làm tăng nguy cơ sai.
- Ảnh tải lên được gửi tới backend. Khi chatbot dùng Gemini, câu hỏi và đoạn tri thức truy xuất được gửi đến Google Gemini API. Không gửi khóa API từ trình duyệt hoặc lưu khóa trong kho mã.
- Chưa có bộ kiểm thử prompt-injection chuyên biệt.

## 5. Cách dùng đúng / sai

**Nên:** tải ảnh rõ, đủ sáng, chủ thể chiếm phần lớn khung hình; xem top-k như gợi ý; kiểm tra nguồn RAG; xác minh thông tin quan trọng bằng nguồn thực vật học đáng tin cậy.

**Không nên:** coi confidence là xác suất đã hiệu chuẩn; kết luận loài ngoài 103 nhãn bằng top-1; dùng detector COCO để khẳng định hoa không tồn tại; xem chatbot là nguồn chuyên môn cuối cùng.

## Cấu hình chatbot

Provider mặc định là Gemini (`LLM_PROVIDER=gemini`, model `gemini-2.5-flash`). Cần đặt `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY` trong backend/secret của nền tảng deploy. Có thể chọn `LLM_PROVIDER=hf_local` để dùng Qwen cục bộ, cần tải trọng số lớn hơn. Không commit khóa API vào Git.
