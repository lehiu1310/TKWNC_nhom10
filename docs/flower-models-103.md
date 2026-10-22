# 103 loài: mô hình thủ tục và ảnh đối chiếu

## Phạm vi

`data/flower_params.json` có một bản ghi và bộ `parameters` cho từng ID trong `data/species.json`. Danh sách được lấy động từ dữ liệu; không có danh sách loài viết tay trong trình xem. Mỗi lần mở trình xem chỉ dựng mô hình của loài đang chọn. Tám bộ sinh hiện có: đĩa, chén, nhiều lớp, năm cánh xoáy, chuông, cụm tròn, sao và cụm dài.

Trong 103 loài, 90 loài dùng mô hình hình học thủ tục. 13 loài có hình thái phức tạp hoặc chưa đủ tín hiệu dùng ảnh thật đến khi có mô hình đã được duyệt. Ảnh này nằm cùng khung trình xem và có nhãn rõ ràng. Mô hình 3D là hình minh hoạ theo nhóm hình thái, không khẳng định là bản tái tạo thực vật học chính xác.

## Nguồn gợi ý và màu

Đã nhận 20 gợi ý tham số từ Gemini `gemini-3.8-flash`. API miễn phí trả HTTP 429 sau khi đạt giới hạn quota, nên 83 bản ghi còn lại được khởi tạo bằng quy tắc từ tên/mô tả rồi hiệu chỉnh bằng audit hình thái cục bộ. Nguồn của từng loài được ghi trong `suggestion_source`; không chạy Gemini khi trang web mở.

`data/flower_photo_colors.json` ghi màu trội đã trích từ ảnh từng loài bằng histogram hue trên vùng giữa ảnh; đây là heuristic, không phải phân đoạn cánh hoa hay k-means. 103/103 ảnh cục bộ được đọc. 55 ảnh có hue khác màu dữ liệu quá ngưỡng 58°. Khi màu dữ liệu xanh lá hoặc lệch, màu hoa dùng trong mô hình ưu tiên màu ảnh trích được (đã loại hue xanh lá để giảm việc nhầm lá/nền thành màu cánh). Các trường `photo_color_mismatch` và `photo_color` cho phép kiểm tra từng quyết định.

## Duyệt trực quan

Với Vite đang chạy, mở `http://localhost:5173/species-review.html?page=0&dense=1`. Trang duyệt chia động thành các trang 21 loài; trang cuối có phần còn lại. Mỗi thẻ dựng mô hình ở độ nở 100% bên cạnh ảnh thật được FastAPI cung cấp. Huy hiệu phân biệt mô hình/ảnh thật và màu lệch; nhãn cảnh báo chỉ là gợi ý để người duyệt kiểm tra.

Sáu bộ mẫu lõi có bản xem riêng tại `http://localhost:5173/template-preview.html` ở độ nở 0%, 50%, 100%. Hai mẫu bổ sung (`star`, `spike`) dùng cùng bộ sinh tham số, không thêm model hay texture tải ngoài.

## Hiệu năng đã kiểm tra

Build Vite cuối đo chunk 3D lazy `RoseViewer` **96.85 KB gzip**. Tổng mọi chunk JavaScript là **317,608 byte gzip** ở `web/dist-baseline` và **366,147 byte gzip** ở bản hiện tại (tăng **48,539 byte**, dưới ngân sách tăng 100 KB). Con số tổng này gồm toàn bộ site, không chỉ khu vườn 3D.

Ở bản build production chạy local trong Codex embedded browser, số đo hiển thị **10 FPS ở 1440 × 900** và **10 FPS ở viewport 375 × 812**, với 32 draw calls, DPR 1, 20 geometry và 4 texture cho Daisy. Khi bộ đo thấy dưới 28 FPS, tuỳ chọn gió tự tắt để giữ khung hình tĩnh nét. Bộ đo Codex không công bố cấu hình GPU/CPU và có thể giới hạn tần số khung hình; vì vậy hai số này không chứng minh được tốc độ trên laptop/điện thoại thật, và mục tiêu 60/30 FPS chưa được xác nhận. Không ghi số RAM vì chưa đo được.

## Tái tạo bảng

Yêu cầu khóa Gemini qua `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY` trong môi trường cục bộ (không ghi khóa vào file). Sinh gợi ý khi quota cho phép, rồi audit, trích màu ảnh và mở rộng tham số:

```powershell
python scripts/generate_flower_params_gemini.py
python scripts/audit_flower_params.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract_flower_photo_colors.ps1
python scripts/expand_flower_params.py
```

Khi quota không còn, không khẳng định các gợi ý cục bộ là kết quả Gemini. Hãy xem `suggestion_source` và `confidence` rồi duyệt contact sheet trước khi quảng bá chất lượng từng mô hình.
