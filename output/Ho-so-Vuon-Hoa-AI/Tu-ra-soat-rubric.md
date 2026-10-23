# Tự rà soát rubric — Vườn Hoa AI

**Căn cứ:** `Hướng dẫn báo cáo cuối kỳ - Lập trình Web nâng cao.pdf`, trạng thái GitHub Actions main run 39916363610, Render deploy hiện tại `dep-dbd5kt6i0phs73es5v1g` và các smoke test production đã lưu trong `reports/`.

## Cách tính điểm trong hướng dẫn

- Điểm nhóm: 80 điểm từ 5 tiêu chí đầu.
- Hỏi đáp cá nhân: 20 điểm; từng người phải tự giải thích phần mình làm và xử lý câu hỏi/sửa code.
- Điểm cộng: tối đa 10 điểm từ Docker Compose đầy đủ, AI có đánh giá hoặc microservices/message queue; tổng cuối không vượt 100.
- Hướng dẫn yêu cầu 10 phút trình bày, khoảng 4 phút hỏi đáp; một phần tổng quan khác ghi 14 phút. Kịch bản hiện dùng 10 + 4 = 14 phút, dưới giới hạn 15 phút.

## Bằng chứng theo tiêu chí

| Tiêu chí | Mức có thể nhắm | Bằng chứng hiện có | Điều kiện còn lại |
|---|---:|---|---|
| Chức năng và demo (25) | Tốt, 22–25 | React/Vercel và API production đang trả HTTP 200; 103 loài; classify, detect, search ảnh, search mô tả và RAG chat đều có smoke test HTTP 200. Lúc 08:01 ngày 23/10, thông tin demo lấy chính xác từ README trên `main` công khai đăng nhập đúng danh tính, đọc garden/giftbook, logout thành công và request garden sau logout bị từ chối bằng 401. | Mỗi AI route mới có một smoke request; đăng ký chưa chạy lại trên Vercel sau deploy gateway; cần nhóm chạy demo trực tiếp. |
| Kiến trúc và chất lượng code (20) | Tốt, 18–20 | React function components/Hooks; Express 5 gateway trên Vercel; FastAPI/Docker/Render cho AI và API tài khoản; Neon PostgreSQL; REST/SSE; validation, xử lý lỗi và quản lý model theo RAM. Kiểm tra live lúc 07:55 ngày 23/10 qua Vercel xác nhận `/api/health` và `/api/startup` trả 200; health báo PostgreSQL. | Đường tài khoản Express dùng DB trực tiếp hay proxy sang FastAPI chưa được quan sát từ runtime; FastAPI production đã xác nhận dùng PostgreSQL. Khi trình bày cần giải thích rõ rewrite, fallback và cold start. |
| Kiểm thử, CI và bảo mật (15) | Tốt, 13–15 | [GitHub Actions main run 39916363610](https://github.com/lehiu1310/TKWNC_nhom10/actions/runs/39916363610) xanh ở `security-audit`, `pytest` và `web-build-and-tests`; pytest hiện hành 107 passed/1 skipped, frontend 24 passed/build. CI dùng PostgreSQL 16, kiểm tra phân quyền dữ liệu, quét secret và audit dependency. | Test PostgreSQL bị skip ở local khi không có DSN; CI là bằng chứng chính cho integration test. |
| Deploy và tài liệu (10) | Tốt, 9–10 | Vercel HTTP 200; Render MCP xác nhận Live revision `ec114f731cd1`; same-origin account smoke; README có `.env.example` và lệnh Compose một bước. Kiểm tra live lúc 07:55 ngày 23/10 xác nhận `/api/health`, `/api/startup`, `/api/auth/me` đều trả 200 (auth/me trả `user: null` đúng với request chưa đăng nhập). Báo cáo PDF 7 trang có bìa/mục lục, slide 12 trang; video WebM dài 4:31 theo metadata. | Clone sạch trên máy khác và mở video offline cần kiểm tra trên máy trình bày. Tag `final` được gắn vào commit nộp. |
| Trình bày (10) | Chưa thể chốt | Slide 12 trang (đúng mức tối đa), sơ đồ, code excerpt 18 pt (đúng yêu cầu tối thiểu), kịch bản 10 phút và video dự phòng đã chuẩn bị. | Đã có lịch chia lời gợi ý cho 3 thành viên; nhóm cần điều chỉnh theo phần chuẩn bị thực tế và tập thử đúng giờ. |
| Hỏi đáp cá nhân (20) | Chưa thể chốt | Bộ câu hỏi có kiến trúc, AI, auth/CSDL, CI/bảo mật, cold start và bài tập đổi mã 3 phút. | Mỗi thành viên phải tự luyện, giải thích code mình nhận và trả lời câu hỏi cá nhân; tài liệu không thể chứng minh năng lực đó. |
| Điểm cộng (tối đa 10) | Có cơ sở xin xét | Docker Compose dựng full stack; AI có metric (classifier, detector, retrieval, RAG); kiến trúc tách gateway Express và service AI FastAPI. | Điểm cộng do giảng viên quyết định; không tự cộng vượt mức 100. |

## Năm mục sản phẩm phải nộp theo hướng dẫn

| Mục | Trạng thái chuẩn bị | Chỗ còn cần người thật / thao tác nộp |
|---|---|---|
| Repo GitHub | Có repo public `https://github.com/lehiu1310/TKWNC_nhom10`; README có lệnh Compose một bước, `.env.example`, hướng dẫn demo; không đưa secret vào Git. Bản code được rà soát ở `202769e` trùng revision backend Render `ec114f731cd1`; commit nộp thêm hồ sơ và không đổi mã ứng dụng. CI run 39916363610 xanh ở `pytest`, `web-build-and-tests` và `security-audit`; bằng chứng JSON trong gói. | Tag `final` trỏ tới commit chứa bộ hồ sơ nộp trên `main`. Commit cá nhân bằng tài khoản riêng để từng thành viên tự làm. |
| Link deploy | Vercel `https://tkwnc-nhom10.vercel.app`; Render `https://tkw-nhom10-api.onrender.com`; API production và account smoke có bằng chứng trong `reports/`. Tài khoản demo trên README công khai đã đăng nhập thành công lúc 08:01 ngày 23/10. | Trước buổi báo cáo, kiểm tra link lại; không đưa password vào slide/video công khai. |
| Báo cáo PDF 5–8 trang | PDF 7 trang A4; có bìa, mục lục, bài toán/người dùng, kiến trúc, REST API, mô hình dữ liệu, tests, đánh giá AI, hạn chế và khai báo OpenAI Codex/ChatGPT. Dàn theo mẫu báo cáo học thuật: Times New Roman, đen trắng, tiêu đề chương và số trang; PDF đã xuất lại và kiểm tra bố cục. | Nội dung báo cáo sẵn sàng; dữ liệu phân công nằm ở biểu mẫu nhóm riêng. |
| Bảng phân công | Biểu mẫu riêng PDF và Excel có công thức cộng tỷ lệ; Hiếu là trưởng nhóm, Huấn và Đông là thành viên; tỷ lệ đề xuất 34% / 33% / 33% tổng đúng 100%. | Phần việc và tỷ lệ là đề xuất cân bằng để nhóm đối chiếu với thực tế. Các ô chữ ký được để trống cho thành viên tự ký. |
| Video demo dự phòng 3–5 phút | Có video WebM 4:31 theo metadata trong gói nháp. | Nhóm cần chép và mở thử khi ngắt mạng trên chính máy trình chiếu. |

Phiếu đánh giá chéo là biểu mẫu **mỗi sinh viên nộp riêng trong 24 giờ sau buổi báo cáo**, không phải mục nộp chung trước báo cáo; bản trống đã chuẩn bị tại `reports/phieu-danh-gia-cheo.md`.

## Việc cá nhân/nhóm tự xác nhận (không phải blocker kỹ thuật của web)

1. Biểu mẫu đã ghi vai trò và phân bổ dự kiến 34% / 33% / 33% tổng 100%. Nhóm rà soát phần việc/tỷ lệ với thực tế rồi từng thành viên tự ký xác nhận.
2. Lịch sử Git hiện chỉ có author `lehiu1310`; mỗi thành viên cần tự tạo commit bằng tài khoản của mình theo hướng dẫn môn học. Đây là việc cá nhân của từng người, để họ tự thực hiện; không tạo commit giả danh.
3. Tag `final` trỏ tới commit chứa bộ hồ sơ nộp trên `main`; mã ứng dụng giữ nguyên revision đã deploy và kiểm tra CI.
4. Trước buổi báo cáo, nhóm nên mở demo và dữ liệu mẫu trên máy trình chiếu; thử video offline nếu nhóm chọn dùng.
5. Tập thử đúng 10 phút trình bày + 4 phút hỏi đáp; phần mỗi thành viên tự trình bày, trả lời và ký xác nhận là việc cá nhân của nhóm, bản rà soát kỹ thuật không thay cho đánh giá đó.

## Kết luận theo phạm vi project/web

Các yêu cầu tối thiểu về sản phẩm trong đề cương đã có bằng chứng đạt: giao diện React dùng function components/Hooks gọi API thật; backend REST có xác thực và PostgreSQL; kiểm thử tự động/CI xanh; frontend và backend đang deploy công khai. Có thêm Compose một lệnh và các luồng AI hoạt động trên production, kèm smoke/metric có ghi rõ giới hạn mẫu. Vì vậy, phần project/web đạt mức tốt có căn cứ để trình bày; không suy ra điểm cuối do giảng viên chấm.

Chữ ký, việc xác nhận phân công với đóng góp thực tế, commit từng người, luyện thuyết trình/hỏi đáp và đánh giá chéo là các mục riêng của nhóm/thành viên. Để đúng phạm vi người dùng yêu cầu, chúng không được tính là blocker cho kết luận về sản phẩm và web. Phiếu phân công đề xuất đã chuẩn bị riêng, không ký thay thành viên.



