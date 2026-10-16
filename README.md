# TKWNC_nhom10 — Vườn Hoa AI

Ứng dụng web toàn diện tra cứu **103 loài hoa** và **bốn chức năng AI thực vật học**:
1. **Kính lúp hoa (Image Classifier)**: Nhận diện loài hoa trong 103 nhãn với xác suất Top-K và bản đồ nhiệt **Grad-CAM** giải thích trực quan các vùng điểm ảnh mạng nơ-ron tập trung.
2. **Mắt thần vườn (Object Detector)**: Định vị hộp bao (Bounding Boxes) cho các loài hoa (hoa hồng, cúc họa mi, hướng dương, bồ công anh) với hỗ trợ **quét webcam trực tiếp** theo luồng và bộ đo FPS thời gian thực.
3. **Album hoa (Multimodal Retrieval)**: Tìm kiếm ảnh thực vật học trong cơ sở dữ liệu 1.236 ảnh bằng văn bản mô tả (tiếng Việt/tiếng Anh) hoặc bằng ảnh mẫu, kết hợp bộ lọc nhãn theo loài.
4. **Cô làm vườn (Chatbot RAG)**: Trợ lý hỏi đáp thông minh sử dụng Gemini 3.8 Flash và cơ chế truy xuất kiến thức BM25 trên cẩm nang chăm sóc, mùa nở và ý nghĩa biểu tượng, kèm dẫn nguồn tài liệu `[cham_soc_hoa.md]`.
5. **Bách khoa 103 loài hoa**: Danh mục đầy đủ 103 loài hoa với ảnh chất lượng cao, tên khoa học, họ thực vật, nhu cầu ánh sáng, cẩm nang tưới nước và kỹ thuật chăm sóc.

---

## Công nghệ & Kiến trúc

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js 22, Express, `@google/genai` (Gemini 3.8 Flash)
- **Dữ liệu**: 103 loài hoa (Oxford Flowers 102 + TF Flowers), 1.236 ảnh trưng bày và kho tài liệu RAG thực vật học
- **Cổng dịch vụ**: Port 3000 (`0.0.0.0:3000`)

---

## Hướng dẫn chạy

```bash
# Cài đặt thư viện
npm install

# Khởi chạy chế độ phát triển
npm run dev

# Kiểm tra cú pháp và build
npm run lint
npm run build
```

---

## API Endpoints

- `GET /api/health` — Trạng thái sức khỏe hệ thống và 4 mô hình AI
- `GET /api/species` — Danh sách 103 loài hoa (hỗ trợ phân trang và tìm kiếm)
- `GET /api/species/:id/image` — Ảnh minh họa của từng loài
- `POST /api/classify` — Phân loại ảnh hoa và trả về xác suất Top-K kèm Grad-CAM
- `POST /api/detect` — Phát hiện hộp bao hoa trong khung hình
- `POST /api/search/text` — Tìm kiếm ảnh hoa qua câu mô tả
- `POST /api/search/image` — Tìm kiếm ảnh tương đồng
- `GET /api/gallery/:id` — Tải ảnh trong kho 1.236 ảnh
- `POST /api/chat` — Trò chuyện trực tuyến (SSE streaming) với Cô làm vườn
- `POST /api/chat/sync` — Trò chuyện đồng bộ (JSON)
