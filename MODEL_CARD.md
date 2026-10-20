# Model Card — Vườn Hoa AI

Tài liệu này chỉ ghi thông tin có thể đối chiếu trong mã nguồn, dữ liệu và báo cáo hiện có trong repo. Những mục repo không lưu bằng chứng được ghi **chưa có** hoặc **chưa đo**.

## 1. Dữ liệu

### Phân loại ảnh

- **Nguồn:** Oxford Flowers 102 (8.189 ảnh) và TensorFlow Flowers `flower_photos` (3.670 ảnh), được ghép trong `scripts/prepare_flowers102.py`; tổng cộng **11.859 ảnh, 103 lớp**. Đây là số ảnh theo manifest/script chuẩn bị dữ liệu trong repo.
- **Chia dữ liệu:** `train_test_split(test_size=0.18, stratify=labels, random_state=42)` trong `scripts/prepare_flowers102.py`. Tổng thực tế suy ra từ manifest và phép chia này: **train 9.724, validation 2.135, test 0**. Không có test split độc lập trong pipeline này.
- **Số ảnh của từng lớp ở train/validation/test, số ảnh nguồn và chỉ số theo lớp:** [`reports/classifier_per_class.csv`](reports/classifier_per_class.csv) (103 dòng lớp; `test_images` đều bằng 0; cột `below_100_total_images` đánh dấu lớp dưới 100 ảnh). Một vài lớp tiêu biểu: daisy 574/126/0; dandelion 776/171/0; roses 624/137/0; sunflowers 649/143/0; tulips 655/144/0 (train/validation/test).
- **76 lớp có dưới 100 ảnh tổng cộng:** alpine-sea-holly (45), artichoke (41), ball-moss (91), balloon-flower (48), barbeton-daisy (41), bearded-iris (54), bishop-of-llandaff (71), black-eyed-susan (54), blackberry-lily (65), blanket-flower (40), bougainvillea (82), bromelia (48), camellia (63), canna-lily (46), canterbury-bells (41), cape-flower (40), carnation (66), cautleya-spicata (50), clematis (86), colt-s-foot (40), columbine (58), corn-poppy (59), cyclamen (82), daffodil (67), desert-rose (63), english-marigold (71), fire-lily (85), foxglove (66), fritillary (49), garden-phlox (78), gazania (96), geranium (67), giant-white-arum-lily (41), globe-flower (87), globe-thistle (60), grape-hyacinth (40), great-masterwort (43), hard-leaved-pocket-orchid (49), hibiscus (63), japanese-anemone (55), king-protea (85), lenten-rose (56), lotus (41), love-in-the-mist (85), mallow (49), marigold (40), mexican-aster (52), mexican-petunia (58), monkshood (66), moon-orchid (62), osteospermum (61), pelargonium (61), peruvian-lily (49), petunia (92), pincushion-flower (82), pink-primrose (40), poinsettia (59), primula (85), prince-of-wales-feathers (91), purple-coneflower (87), red-ginger (56), ruby-lipped-cattleya (46), siam-tulip (75), silverbush (52), snapdragon (45), spear-thistle (46), spring-crocus (42), stemless-gentian (42), sweet-william (40), tiger-lily (67), tree-poppy (78), trumpet-creeper (56), wallflower (93), watercress (76), windflower (54), yellow-iris (45).
- **Độ chính xác của từng lớp:** precision, recall, F1 và support validation có trong `reports/classifier_evaluation.json` và CSV trên. Recall ở đây cũng là độ chính xác có điều kiện theo lớp (tỉ lệ ảnh thật thuộc lớp đó được nhận đúng); độ chính xác one-vs-rest riêng cho từng lớp **chưa có**.
- **Ma trận nhầm lẫn:** đã có file [`reports/classifier_confusion_matrix.csv`](reports/classifier_confusion_matrix.csv); ảnh heatmap ma trận nhầm lẫn **chưa có**. Ảnh minh hoạ Grad-CAM có tại [`reports/gradcam_rose_example.jpg`](reports/gradcam_rose_example.jpg).

### Phát hiện đối tượng

- **Nguồn dữ liệu gán nhãn:** [Weirdo-329/flower-detection-dataset](https://huggingface.co/datasets/Weirdo-329/flower-detection-dataset), khai báo Apache-2.0 trong [`data/detection_flowers_yolo/dataset_report.json`](data/detection_flowers_yolo/dataset_report.json); mô tả nhãn COCO gốc tại `data/detection_flowers/README.md`.
- **Quy mô/lớp:** 831 ảnh, 1.280 bounding box; daisy, dandelion, roses, sunflowers. Số box theo README nguồn: daisy 322, dandelion 226, roses 269, sunflowers 463.
- **Chia tập:** seed 42, xáo trộn xác định rồi chia 80%/10%/phần còn lại trong `scripts/prepare_flower_detection.py`: train 664 ảnh, validation 83, test 84. Báo cáo lưu tại `data/detection_flowers_yolo/dataset_report.json`.
- **Ảnh dự đoán:** có ảnh lô validation tại `runs/detect/flower_yolo11n/val_batch0_pred.jpg`, `val_batch1_pred.jpg`, `val_batch2_pred.jpg`; các file nhãn thật tương ứng có hậu tố `_labels.jpg`. Ma trận nhầm lẫn có trong thư mục `runs/detect/flower_yolo11n/`.

### Tìm ảnh

- **Index:** 1.236 ảnh, MobileCLIP2-S0 (`dfndr2b`), embedding 512 chiều; metadata và số ảnh ghi tại `artifacts/retrieval/meta.json` và `artifacts/retrieval/encoder.json`. Script chuẩn bị index chọn tối đa 12 ảnh/lớp từ dữ liệu hoa hiện có; chi tiết trong `scripts/prepare_flowers102.py`.
- **Đánh giá truy vấn ảnh:** 206 ảnh truy vấn cùng nguồn dữ liệu, giới hạn tối đa 2 truy vấn/lớp, loại khỏi index theo đường dẫn; một kết quả được tính liên quan khi `species_id` trùng nhãn ảnh truy vấn. Protocol nằm trong `reports/retrieval_precision_at_5.json` và `scripts/evaluate_retrieval.py`.
- **Đánh giá truy vấn mô tả tiếng Việt:** 10 câu mô tả viết trong `scripts/evaluate_vietnamese_search.py`, 2 câu cho mỗi lớp trong 5 lớp trang chủ; không ngẫu nhiên và không được ghi là đánh giá độc lập.
- **Ví dụ đúng:** “một bông cúc trắng đơn độc bên mép đồng cỏ” → daisy đứng cả 5 kết quả, P@5 = 1,0.
- **Ví dụ sai:** “đóa vàng lớn với tâm nâu tròn, cánh xếp tỏa ra ngoài” → sunflower nhưng 5 kết quả là tree-poppy/sword-lily, P@5 = 0; “bông hoa hình chén màu hồng trên thân thẳng, lá dài” → tulips nhưng không có tulip trong top 5, P@5 = 0. Kết quả đầy đủ trong `reports/vietnamese_search_precision_at5.json`.

### Hỏi đáp RAG và “Cô làm vườn”

- **Kho tài liệu trong repo:** 8 tệp Markdown tiếng Việt và 2 PDF (`data/kb/`). Hai PDF có 56 trang (K-State, 2019) và 38 trang quét (USDA, 1901); các tài liệu web khác chỉ được liệt kê/liên kết trong `data/kb_sources.md`, không tính là file đã nạp.
- **Số chunk:** 750 chunk được đếm bằng `core.llm.load_chunks()` trên corpus hiện tại (mặc định tối đa 600 ký tự/chunk, overlap 100 ký tự; Markdown tách theo đề mục, PDF tách theo trang). Số chunk không được lưu thành artifact riêng; có thể tái tạo bằng hàm này.
- **30 câu hỏi:** các câu hỏi và tệp nguồn mong đợi nằm trong `data/kb_eval/rag_hit_at_3.json` (6 câu cho mỗi tệp hoa được kiểm tra). `scripts/evaluate_rag.py` gọi đây là bộ câu hỏi đã rà soát, nhưng repo **chưa có** tên người viết, quy trình tạo, hay nguồn gốc từng câu hỏi ngoài nhãn `source`.
- **Câu khó/ngoài phạm vi:** bộ đánh giá riêng cho câu khó hoặc ngoài phạm vi **chưa có**.

## 2. Chỉ số

| Chức năng | Chỉ số có trong repo | Tập và giới hạn diễn giải |
|---|---|---|
| Phân loại ResNet-18 | Accuracy **90,26%**; macro-F1 **91,56%**; weighted-F1 **90,24%**. Precision/recall/F1/support theo lớp có trong báo cáo. | 2.135 ảnh validation, 103 lớp. Validation được dùng chọn checkpoint; test độc lập **chưa có**. Ma trận nhầm lẫn CSV có; ảnh heatmap **chưa có**. |
| Phát hiện YOLO11n | mAP50 **73,06%**; mAP50–95 **52,36%**; precision **66,41%**; recall **74,11%**. | Test 84 ảnh/145 hộp; fine-tune 3 epoch, ảnh 320 px. Đo CPU Intel Core i5-13500H, Torch 2.14.0+cpu, Ultralytics 8.4.165. mAP theo lớp ở bảng dưới và `reports/detector_evaluation.json`. |
| Tìm ảnh bằng ảnh | Precision@5 **85,92%** (206 query). | Truy vấn held-out theo đường dẫn từ cùng bộ dữ liệu; không đại diện ảnh ngoài miền. |
| Tìm ảnh bằng mô tả tiếng Việt | Precision@5 trung bình **22%** (10 query); cả 10 câu đều được dịch. | Bộ câu nhỏ, viết thủ công cho 5 lớp; các ví dụ sai được liệt kê ở mục Dữ liệu. |
| RAG truy xuất nguồn | Hit@3 **30/30 = 100%**. | Đo việc nguồn mong đợi xuất hiện trong 3 nguồn đầu của BM25, **không đo độ đúng/đầy đủ của câu trả lời Gemini**. Đánh giá ngoài phạm vi **chưa đo**. |
| “Cô làm vườn” — chất lượng câu trả lời | Độ đúng câu trả lời, độ an toàn và chất lượng trích dẫn đầu-cuối: **chưa đo**. | Không có bộ đánh giá đáp án sinh trong repo; Hit@3 chỉ đo truy xuất. |

Các file bằng chứng: `reports/classifier_evaluation.json`, `reports/classifier_confusion_matrix.csv`, `reports/classifier_per_class.csv`, `reports/detector_evaluation.json`, `reports/retrieval_precision_at_5.json`, `reports/vietnamese_search_precision_at5.json`, `reports/rag_hit_at_3.json`.

### Phát hiện — kết quả theo lớp trên test split

| Lớp | Precision | Recall | mAP50 | mAP50–95 |
|---|---:|---:|---:|---:|
| Daisy | 60,10% | 76,47% | 75,65% | 55,56% |
| Dandelion | 82,50% | 76,92% | 80,86% | 65,16% |
| Roses | 57,94% | 65,45% | 68,58% | 42,16% |
| Sunflowers | 65,11% | 77,59% | 67,17% | 46,56% |

Tái tạo phép đo: `.venv/Scripts/python scripts/evaluate_flower_detector.py` (Windows: `\.venv\Scripts\python.exe scripts/evaluate_flower_detector.py`).

## 3. Giới hạn

- Classifier chỉ dự đoán trong 103 nhãn đã huấn luyện; 76 lớp có ít hơn 100 ảnh. Không có test split độc lập, nên số accuracy/F1 hiện có không phải kết quả test độc lập.
- Detector chỉ có bốn lớp được nêu ở mục Dữ liệu; không có lớp “hoa” tổng quát. Ảnh ngoài miền hoặc hoa nhỏ/chồng lấp có thể bị bỏ sót hay khoanh sai.
- Tìm ảnh trả ảnh tương tự theo embedding, không xác nhận danh tính thực vật. P@5 trên mô tả tiếng Việt hiện thấp (22%) theo bộ 10 câu trong repo.
- **Cơ chế “Cô làm vườn”:** endpoint `/api/chat` dùng `RAGChatbot` trong `core/llm.py`: BM25 truy xuất chunk từ `data/kb/`, rồi provider Gemini (mặc định `LLM_PROVIDER=gemini` trong `config.py`) sinh câu trả lời có nguồn nếu API khả dụng. Khi không có khóa/provider không dùng được, code có đường fallback trích nội dung truy xuất; vì vậy không phải mọi phản hồi đều là câu trả lời do mô hình sinh. Đây không phải mô hình chuyên biệt đã huấn luyện để chẩn đoán bệnh cây. Độ đúng câu trả lời sinh **chưa đo**.
- Corpus chỉ có 10 file, trong đó hai PDF đều về hướng dương; phạm vi và tính cập nhật tài liệu không đồng đều. Bộ 30 câu hỏi chỉ đo tìm đúng nguồn, chưa có tập câu hỏi ngoài phạm vi hoặc chấm đáp án.
- Gợi ý của chatbot chỉ mang tính tham khảo, không thay thế chuyên gia/khuyến nông; không dùng để quyết định cây có độc, ăn/uống được hay điều trị bằng thuốc.

### Tặng hoa — hệ thống quy tắc, không phải mô hình AI

- `data/gift_meanings.json` có 103 mục: 28 loài ứng viên (`gift_ok=true`) và 75 loài chỉ giữ ý nghĩa chung từ `species.json`; tất cả mục hiện `verified=false`. Các ánh xạ dịp/người nhận và lưu ý tập quán là bản nháp, chưa có nguồn văn hoá độc lập trong repo để xác minh.
- Bộ gợi ý chấm quy tắc theo dịp, người nhận và màu, loại các dịp được đánh dấu tránh, rồi trả tối đa ba phối bó. API `POST /api/gifts/recommend` chỉ đọc JSON cục bộ, không nạp thêm model. Độ đúng gợi ý, mức phù hợp văn hoá và chất lượng bó: **chưa đo**.
- Lời nhắn có thể dùng Gemini qua endpoint chatbot hiện có; khi endpoint lỗi/quota, giao diện chuyển sang ba mẫu offline. Lời nhắn và ý nghĩa không được xem là nguồn văn hoá.
- `data/kb/y_nghia_tang_hoa.md` đưa các bản nháp vào RAG với trích dẫn nội bộ; chatbot phải nói rõ dữ liệu chưa xác minh. Ý nghĩa hoa thay đổi theo vùng miền, tôn giáo, gia đình, màu và quan hệ người tặng/người nhận. Cần hỏi người nhận/gia đình trong tình huống nhạy cảm, nhất là chia buồn/thờ cúng.
- Sổ hoa dùng `localStorage`, không cần đăng nhập và không đồng bộ giữa thiết bị; người dùng có thể xoá dữ liệu. Ảnh thiệp được tạo trong trình duyệt.

## 4. Rủi ro

Dự đoán sai có thể gây nhầm lẫn về loài, độc tính hoặc cách chăm sóc. Tài liệu truy xuất là dữ liệu bên ngoài không tin cậy; prompt có chỉ dẫn bỏ qua lệnh nằm trong tài liệu nhưng không bảo đảm chống mọi prompt injection. Khi Gemini hoạt động, câu hỏi và các đoạn tài liệu liên quan được gửi tới Gemini API. Không đưa API key vào frontend hoặc Git.

## 5. Cách dùng đúng / sai

**Nên:** dùng ảnh rõ, đủ sáng, một chủ thể; xem top-k và confidence như gợi ý; mở nguồn trích dẫn và đối chiếu nguồn thực vật học đáng tin cậy. **Không nên:** coi top-1 là chắc chắn, diễn giải confidence như xác suất đã hiệu chuẩn, xem detector không khoanh vùng là bằng chứng không có hoa, hoặc coi “Cô làm vườn” là chuyên gia chẩn đoán.
