# Kịch bản video demo 3 phút — Vườn Hoa AI

**Mục tiêu:** đi qua luồng chính và bốn tính năng AI; có một ví dụ mô hình nhận sai và giải thích cách hệ thống thể hiện giới hạn. Quay màn hình bản deploy thật, không ghép kết quả giả.

## Chuẩn bị trước khi quay

1. Mở https://tkwnc-nhom10.vercel.app/ ở cửa sổ trình duyệt sạch, phóng to 100%, tắt thông báo desktop.
2. Kiểm tra `/api/health`. Nếu Render đang cold start, đợi dịch vụ sẵn sàng trước khi ghi hình.
3. Chuẩn bị một ảnh hoa hồng rõ nét; chuẩn bị thêm ảnh kiểm tra đã ghi nhận detector dễ nhầm. Trạng thái đã xác minh ở lần kiểm tra gần nhất: ảnh hoa hồng trả `vase`, `cup`, `potted plant` từ bản COCO cũ; chỉ dùng như ví dụ sai nếu kết quả đó còn tái hiện lúc quay.
4. Thử trước Gemini. Nếu chatbot trả 503 hoặc detector chưa cập nhật, giữ nguyên lỗi thật trong video và nói rõ trạng thái; không thay bằng ảnh chụp kết quả khác phiên bản.

## Lời thoại và thao tác theo thời gian

| Thời gian | Hình ảnh/thao tác | Lời thoại gợi ý |
|---|---|---|
| 0:00–0:18 | Hero trang chủ, lướt nhanh đến 4 tác vụ | “Đây là Vườn Hoa AI, ứng dụng web có bốn chức năng: phân loại ảnh, phát hiện đối tượng, tìm ảnh tương tự và chatbot RAG.” |
| 0:18–0:52 | Mở Kính lúp hoa, tải ảnh hồng, cho kết quả hiện | “Với ảnh đầu vào, API trả các lớp dự đoán và điểm số. Model phân loại có 103 nhãn; giao diện Bách khoa giới thiệu năm loài tiêu biểu.” Chỉ đọc top-1/top-5 đúng như kết quả live. |
| 0:52–1:22 | Mở Mắt thần vườn; hiển thị ảnh và các hộp dự đoán | “Detector khoanh vùng đối tượng và gắn nhãn. Phiên bản local đã fine-tune bốn lớp hoa; kết quả triển khai phải được đối chiếu vì backend có thể chưa cập nhật.” |
| 1:22–1:50 | Mở Album hoa, tìm bằng câu tiếng Việt hoặc ảnh | “Album tìm ảnh gần giống trong index 1.236 ảnh. Truy vấn tiếng Việt được xử lý trước khi tìm; kết quả là ảnh tương tự trong kho chứ không phải xác nhận chuyên gia.” |
| 1:50–2:18 | Hỏi chatbot “Hoa hồng có ý nghĩa gì?”; chờ câu trả lời/nguồn | “Chatbot truy xuất tài liệu tiếng Việt bằng BM25 rồi dùng Gemini để tạo câu trả lời. Thẻ nguồn cho biết nội dung tham khảo; chất lượng câu trả lời vẫn cần kiểm chứng.” Nếu key chưa hoạt động, ghi lại lỗi 503 thật và không đọc response giả. |
| 2:18–2:42 | Tái hiện ca detector/classifier sai; zoom nhãn/response | “Đây là ca mô hình sai: ảnh hoa hồng bị gán các nhãn COCO như bình hoa/cây trồng. Hệ thống vẫn hiển thị nhãn và điểm số để người dùng thấy dự đoán, nhưng không có cơ chế đảm bảo nhận biết mọi ảnh ngoài phân phối.” Chỉ dùng nếu lỗi tái hiện. |
| 2:42–3:00 | Kết thúc tại Bách khoa/README, hiện URL và giới hạn | “Mã nguồn, hướng dẫn chạy, model card và báo cáo số đo nằm trên GitHub. Các chỉ số được ghi theo đúng tập đánh giá; hạn chế chính là detector live chưa đồng bộ, kho RAG chưa đủ 20 trang và Gemini phụ thuộc secret deploy.” |

## Sau khi quay

- Lưu video MP4 dài không quá 3 phút và chèn vào README hoặc nộp cùng báo cáo.
- Chụp ảnh tĩnh trực tiếp từ cùng phiên quay cho hero và từng panel có kết quả thật.
- Nếu backend đã được deploy lại, sửa lời thoại ca sai theo kết quả tái kiểm tra; không giữ mô tả COCO cũ nếu nó không còn đúng.
