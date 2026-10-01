# Model Card — Vườn Hoa AI

## 1. Dữ liệu

- **Phân loại ảnh:** 11.859 ảnh, 103 nhãn; Oxford Flowers 102 (8.189 ảnh, 102 lớp) kết hợp TF Flowers (bổ sung tulip). Tập không cân bằng; 76 lớp có dưới 100 ảnh. Năm lớp nổi bật: daisy 700, dandelion 947, roses 761, sunflowers 792, tulips 799 ảnh. Đây là bộ dữ liệu hoa công khai, thiên về các loài phổ biến ở Anh.
- **Phát hiện:** 831 ảnh gán hộp (1.280 hộp, 4 lớp: daisy, dandelion, roses, sunflowers) từ [Weirdo-329/flower-detection-dataset](https://huggingface.co/datasets/Weirdo-329/flower-detection-dataset), Apache-2.0; chia train/validation/test 664/83/84, seed 42.
- **Tìm ảnh:** FAISS chứa 1.236 ảnh đại diện. **RAG:** 8 tài liệu Markdown tiếng Việt và 30 câu hỏi đánh giá nội bộ.

## 2. Chỉ số đã đo

| Thành phần | Kết quả thật | Phạm vi đo |
|---|---:|---|
| ResNet-18 | Accuracy 90,26%; macro-F1 91,56% | Validation 2.135 ảnh/103 lớp; cùng split chọn checkpoint, không phải test độc lập. |
| YOLO11n | mAP50 0,7306; mAP50–95 0,5236; precision 0,6641; recall 0,7411 | Test riêng 84 ảnh, 145 instances; CPU Intel Core i5-13500H. |
| MobileCLIP2 + FAISS | Precision@5 0,8592 | 206 query ảnh held-out theo đường dẫn, cùng nguồn dataset; không đại diện dữ liệu ngoài miền. |
| RAG | Hit@3 29/30 (0,9667) | Chấm đúng tệp nguồn truy xuất; chưa chấm tính đúng câu trả lời sinh. |
| Render API | Classify p50/p95 3,90/4,50 s; detect 38,74/55,45 s | Locust, 102/51 request, 1 user, 0 lỗi. Render Free Singapore, 0,15 CPU/512 MB; process peak RSS 423,3/506,2 MB. Search và chatbot chưa có benchmark live tin cậy. |

Chi tiết và tệp đo ở [`README.md`](README.md) và `reports/`. Latency/RAM trên là phép đo lịch sử của dịch vụ, không phải cam kết cho revision mới. Kiểm tra live 01/10/2026: `/api/health` trả `status: ok`, ảnh hồng được phân loại top-1 `roses` 0,751; chatbot `POST /api/chat/sync` trả 503, `Mô hình 'llm' chưa sẵn sàng`.

## 3. Giới hạn

Classifier chỉ trả một trong 103 nhãn và có thể gán nhãn gần nhất cho ảnh ngoài phân phối; confidence chưa được hiệu chuẩn. YOLO chỉ có bốn lớp hoa đã liệt kê, không có lớp tulip hoặc lớp “hoa” tổng quát. CLIP tìm ảnh tương tự, không xác nhận danh tính thực vật. RAG bị giới hạn bởi tám tài liệu ngắn; câu trả lời Gemini có thể thiếu hoặc sai. Detector mới train 3 epoch; kết quả còn yếu trên ảnh khác miền.

## 4. Rủi ro

Dự đoán sai có thể gây nhầm lẫn về loài, độc tính hoặc cách chăm sóc; không dùng cho quyết định y tế, ăn/uống hay nông nghiệp có hậu quả cao. Ảnh tải lên được gửi tới backend; khi Gemini hoạt động, câu hỏi và đoạn tri thức được gửi tới Google Gemini API. Không đưa API key vào frontend hoặc Git.

## 5. Cách dùng đúng / sai

**Nên:** dùng ảnh rõ, đủ sáng, một chủ thể; xem top-k và độ tin cậy như gợi ý; kiểm tra nguồn chatbot và đối chiếu nguồn thực vật học đáng tin cậy. **Không nên:** coi top-1 là chắc chắn, diễn giải confidence như xác suất đã hiệu chuẩn, dùng YOLO để khẳng định không có hoa, hoặc xem chatbot là nguồn chuyên môn cuối cùng.
