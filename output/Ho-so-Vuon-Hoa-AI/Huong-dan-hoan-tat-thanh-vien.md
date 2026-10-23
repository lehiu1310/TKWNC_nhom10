# Các bước cuối để nhóm chốt bản nộp

## 1. Điền bảng phân công

Mở `Bang-phan-cong-editable.xlsx`; tên, mã, vai trò và phần việc/tỷ lệ đề xuất đã được điền. Nhóm rà soát phần việc và tỷ lệ theo đóng góp thật, chỉnh nếu cần, rồi mỗi thành viên tự ký. Nhập phần trăm như `25%`; bảng tự cộng và báo khi đủ 100%. Bỏ trống các dòng không dùng. In `Bang-phan-cong.pdf` nếu cần ký tay.

Không ký thay thành viên hoặc xem phần phân công đề xuất là xác nhận cuối nếu nhóm chưa đối chiếu với đóng góp thực tế. Kiểm tra tên, mã và phần xác nhận trong biểu mẫu phân công riêng; báo cáo PDF là tài liệu độc lập, giữ trong khoảng 5–8 trang.

## 2. Mỗi thành viên tạo commit bằng tài khoản của mình

1. Mời từng người vào repo GitHub nếu họ chưa có quyền cộng tác.
2. Mỗi người đăng nhập Git/GitHub bằng tài khoản cá nhân và tự làm một thay đổi thực tế thuộc phần việc đã khai trong bảng.
3. Chạy kiểm tra phù hợp, commit thay đổi rồi push lên repo. Không đặt tên/email Git của người khác, không giả author, không dùng commit rỗng.
4. Kiểm tra commit đã hiện trên GitHub với đúng tài khoản của người làm. Các commit cần có trên nhánh `main` trước khi gắn tag nộp.

Lịch sử đã kiểm tra khi tạo gói này mới cho thấy author `lehiu1310`; vì vậy yêu cầu commit của các thành viên khác vẫn chưa hoàn tất.

## 3. Tag nộp

Tag `final` hiện đã được đẩy lên GitHub và trỏ tới commit chứa bộ hồ sơ nộp trong `main`. Nếu các thành viên tạo thêm commit sau đó, nhóm cần chốt lại `main` và cập nhật tag để nó trỏ tới commit nộp cuối cùng. Việc này sẽ thay tag hiện tại:

```powershell
git switch main
git pull --ff-only
git tag -fa final HEAD -m "Final submission"
git push --force origin refs/tags/final
git ls-remote --tags origin final
```

Chỉ cập nhật tag sau khi nhóm xác nhận commit cuối cùng; không giả danh thành viên hoặc tạo commit rỗng để đủ lịch sử.

## 4. Kiểm tra và nộp

- Mở Vercel, đăng nhập tài khoản demo và thử luồng chính.
- Clone repo sạch trên một máy khác, làm theo README và chạy ứng dụng bằng một lệnh.
- Mở `Video-demo-offline.webm` trên máy trình chiếu khi tắt mạng.
- Tập 10 phút trình bày + 4 phút hỏi đáp; mọi thành viên phải nói và tự giải thích phần mình làm.
- Nộp repo, hai link deploy, báo cáo PDF, bảng phân công đã xác nhận và video dự phòng lên hệ thống môn học trước hạn. Mỗi sinh viên tự nộp phiếu đánh giá chéo trong 24 giờ sau buổi báo cáo.
