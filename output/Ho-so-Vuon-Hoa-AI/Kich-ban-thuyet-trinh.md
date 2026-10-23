# Kịch bản bảo vệ 10 phút — Vườn Hoa AI

**Bản làm việc:** tên và mã sinh viên đã có; lịch chia lời dưới đây là gợi ý để cả ba người đều nói, nhóm có thể đổi theo phần chuẩn bị thực tế. Kịch bản nhắm 10 phút trình bày và demo, 4 phút hỏi đáp.

## Phân bổ thời gian và lời dẫn

| Mốc | Slide | Người nói | Mục tiêu |
|---|---:|---|---|
| 0:00–1:30 | 1–3 | Nguyễn Hữu Lê Hiếu (23010895) | Bài toán, người dùng và bốn luồng AI |
| 1:30–3:30 | 4–5 | Phạm Văn Huấn (23010331) | Sơ đồ React/Vercel → Express gateway + FastAPI → Neon; auth, REST, Docker và lý do tách service |
| 3:30–6:30 | 6–8 | Đào Duy Đông (24100085) | Metric, giới hạn bộ dữ liệu và demo trực tiếp, gồm lỗi chưa đăng nhập |
| 6:30–8:30 | 9–10 | Nguyễn Hữu Lê Hiếu (23010895) | Model theo nhu cầu, quản lý RAM và cold start |
| 8:30–10:00 | 11–12 | Phạm Văn Huấn (23010331) | CI, bảo mật, deploy, giới hạn và kết luận |

Tổng thời lượng trình bày: **10:00**. Hỏi đáp: **4:00**; giữ tổng thời gian dưới 15 phút.

## Lời nói gợi ý

### Nguyễn Hữu Lê Hiếu — slides 1–3

“Nhóm em xây dựng Vườn Hoa AI, website tiếng Việt giúp người yêu hoa tra cứu 103 loài, nhận diện ảnh, tìm ảnh theo ảnh hoặc mô tả, và hỏi đáp từ kho tài liệu có dẫn nguồn. Bốn luồng AI gồm phân loại ảnh ResNet, phát hiện hoa YOLO, truy xuất ảnh, và chatbot BM25/RAG. Người dùng còn có thể đăng nhập để lưu Sổ hoa và Sổ quà. Trang gợi ý bó hoa dùng luật dữ liệu, không phải mô hình AI. Sau đây là kiến trúc và cách các luồng trao đổi dữ liệu.”

### Phạm Văn Huấn — slides 4–5

“Frontend React dùng function component và Hooks, triển khai trên Vercel. Các lệnh same-origin được rewrite theo nhóm chức năng: route tài khoản đi qua gateway Node.js/Express 5; route AI tới FastAPI đóng Docker trên Render. Express có vai trò gateway; luồng tài khoản production hiện được chuyển tiếp tới FastAPI Render. FastAPI dùng Neon PostgreSQL cho tài khoản, phiên và dữ liệu riêng. Như vậy CSDL production là PostgreSQL; bản chạy local hoặc Compose dùng SQLite để dễ dựng.

Giữ auth và website cùng origin giúp cookie phiên hoạt động an toàn hơn qua HttpOnly, SameSite=Lax và HTTPS. Ở backend, FastAPI kiểm tra dữ liệu đầu vào trước khi gọi model, chuẩn hóa lỗi API và kiểm soát model nặng để phù hợp RAM gói miễn phí. REST dùng cho các thao tác thường; chatbot cũng có luồng phản hồi streaming. Docker Compose mô tả các thành phần cần thiết để chạy toàn bộ ứng dụng cục bộ bằng một lệnh. Sơ đồ này phản ánh code production hiện tại; adapter DB trực tiếp của Express chưa được tính là đường đang dùng.”

### Đào Duy Đông — slides 6–8 (metric và demo)

“Nhóm báo cáo cả kết quả lẫn giới hạn phép đo. Classifier đạt accuracy 90,26% trên validation; checkpoint được chọn theo chính validation nên đây không phải test độc lập. Detector có test split riêng, nhưng chỉ có bốn lớp và 84 ảnh. Bộ truy xuất ảnh đạt Precision@5 0,9165 trên 206 query held-out theo đường dẫn, nhưng cùng nguồn ảnh phát triển nên chưa chứng minh khả năng tổng quát. RAG đạt Hit@3 31/31 trên câu hỏi do nhóm biên soạn; số liệu này đo truy xuất tài liệu, không khẳng định mọi câu trả lời sinh đều đúng.”

#### Demo trực tiếp — 2 phút

“Mở trang deploy và nhập mô tả ‘đóa vàng lớn, tâm nâu tròn, cánh tỏa ra ngoài’. API tìm kiếm trả về các loài phù hợp; với truy vấn mẫu đã đo, năm kết quả đầu là hướng dương. Kết quả này minh họa tìm kiếm theo mô tả, không phải kết luận nhận diện chắc chắn. Tiếp theo em mở route dữ liệu garden trong phiên chưa đăng nhập. API trả 401, tức là từ chối truy cập đúng như yêu cầu bảo vệ dữ liệu cá nhân. Nếu còn thời gian, em mở trang chi tiết loài và chỉ luồng nhận diện ảnh. Nếu server khởi động chậm, nhóm chuyển sang video dự phòng và nói rõ đó là bản ghi trước.”

### Nguyễn Hữu Lê Hiếu — slides 9–10 (2 phút)

#### Vấn đề kỹ thuật — 2 phút

“Điểm khó là chạy nhiều model ảnh trên Render Free có giới hạn RAM. Nếu nạp classifier, detector và retrieval cùng lúc, tiến trình có nguy cơ vượt bộ nhớ. Hàm `_run_heavy_model` trong FastAPI dùng khóa để chỉ cho một tác vụ nặng chạy tại một thời điểm; trước khi nạp model mới, `_evict_for_render_free` nhả model không cần thiết, thu gom bộ nhớ rồi mới gọi `_require` để nạp đúng model. Health endpoint vẫn cho biết các route khả dụng, còn trạng thái resident cho biết model nào đang ở trong RAM.

Đây là đánh đổi: footprint bộ nhớ thấp hơn nhưng lần đầu gọi một model có thể chậm do cold start hoặc phải nạp lại. Vì vậy nhóm không trình bày thời gian một lượt smoke test như benchmark. Chatbot truy xuất nguồn bằng BM25 trước; Gemini Free Tier có thể tạo lời giải thích khi khả dụng. Khi thiếu khóa, quota hoặc provider trả lỗi, ứng dụng vẫn đưa phần trả lời dựa trên RAG và nguồn. Nhóm không bật billing trả phí.”

### Phạm Văn Huấn — slides 11–12

“CI GitHub Actions tại main ec114f7 chạy xanh: 107 backend pass, một test PostgreSQL được skip ở local không có DSN; frontend 24 test pass và production build thành công; security audit cũng xanh. CI chạy PostgreSQL 16 integration để kiểm tra quyền dữ liệu giữa người dùng. Render đang Live ở `ec114f731cd1`; smoke test mới trên chính revision này cho cả năm AI route trả HTTP 200. Login và đọc/ghi sổ được kiểm tra qua production same-origin.

Về bảo mật, mật khẩu được băm bằng scrypt và salt, session gửi bằng cookie HttpOnly, dữ liệu riêng truy vấn theo user phía server, input được giới hạn và secret không commit. Các giới hạn còn lại là cold start gói miễn phí, detector ít lớp, dữ liệu đánh giá nhỏ và kho RAG do nhóm biên soạn. Nếu có thêm thời gian, nhóm sẽ mở rộng bộ test độc lập, lớp detector và nguồn kiến thức; đồng thời đo tải nhiều người. Trong 4 phút hỏi đáp, mỗi thành viên tự giải thích phần mình phụ trách, không trả lời thay.”

## Chuẩn bị và chạy demo live

**Trước giờ bắt đầu 2–3 phút:** kiểm tra URL public, mở trước ảnh mẫu, gọi một truy vấn tìm kiếm để làm nóng Render, kiểm tra login demo và video local. Không hiển thị mật khẩu, token, dashboard có secrets hoặc thông tin tài khoản thật.

**Trong 2 phút demo (slide 9):**

1. Mở trang public Vercel và chỉ nhanh ô tìm kiếm.
2. Nhập `đóa vàng lớn, tâm nâu tròn, cánh tỏa ra ngoài`; kỳ vọng kết quả chủ yếu là hướng dương. Query đã xác minh qua API production, top 5 đều thuộc `sunflowers`.
3. Mở đường dẫn `/api/account/data/garden` trong cửa sổ chưa đăng nhập; kỳ vọng HTTP 401. Giải thích đây là bảo vệ dữ liệu cá nhân, không phải lỗi deploy.
4. Quay lại website và nêu gọn vị trí đăng nhập/demo account; không cần nhập mật khẩu trước lớp nếu thời gian còn dưới 30 giây.

Nếu tìm kiếm mất hơn 20 giây hoặc lỗi mạng, chuyển sang video dự phòng; nói rõ video là bản ghi trước đó. Không bấm deploy hoặc sửa Environment Variables trong lúc thuyết trình.

## Hỏi đáp 4 phút và bài tập đổi mã

- Mỗi thành viên tự trả lời ít nhất một câu; không trả lời thay người khác. Chia câu theo phần thật sự đã làm và đã đọc.
- Nếu được yêu cầu sửa nhanh: giải thích request → validation → xử lý → response; chọn một validation giới hạn `top_k` hoặc thêm test cho truy vấn rỗng; sửa và chạy đúng test nhỏ trong tối đa 3 phút.
- Nếu không nhớ chính xác, nói rõ giới hạn và mở file/API liên quan. Gemini Free Tier đã được gọi; nêu rõ đôi khi lỗi 503 thì RAG dự phòng trả lời.
- Dùng bộ câu hỏi ở [`bo-cau-hoi-bao-ve.md`](bo-cau-hoi-bao-ve.md); mỗi người tự luyện ít nhất một câu thiết kế, một câu lỗi/bảo mật và một phần code.

## Việc nhóm cần xác nhận trước khi nộp

- Lịch chia lời trên là gợi ý; đổi theo công việc thật nếu cần và bảo đảm mọi thành viên đều nói.
- Chỉnh tỷ lệ đóng góp theo thực tế, tổng 100%, và xin đủ chữ ký; không để bản nháp này thay cho xác nhận.
- Mỗi thành viên tự tạo ít nhất một commit bằng GitHub account của mình; lịch sử hiện tại chỉ cho thấy author `lehiu1310`.
- Mở video trên chính máy thuyết trình khi ngắt mạng; mỗi thành viên tự tập phần code mình chịu trách nhiệm và chuẩn bị phiếu đánh giá chéo sau buổi báo cáo.
