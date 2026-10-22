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

- **Backend production:** 1.236 ảnh với đặc trưng penultimate-layer ResNet-18 512 chiều; metadata và đặc trưng ở `artifacts/retrieval/meta.json` và `artifacts/retrieval/classifier_features.npy`. Tìm ảnh dùng ảnh truy vấn để lấy đặc trưng rồi lọc gallery theo lớp dự đoán khi độ tin cậy đạt ngưỡng `CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE=0.4`. Backend này dùng ít bộ nhớ hơn CLIP và hiện được cấu hình cho Render Free.
- **Đánh giá truy vấn ảnh:** Precision@5 **91,65%**, top-1 classifier accuracy **90,29%** trên 206 ảnh giữ ngoài gallery theo đường dẫn, tối đa 2 truy vấn/lớp. Nguồn truy vấn vẫn thuộc cùng bộ Flowers đã dùng để huấn luyện/chuẩn bị gallery; đây là đánh giá nội bộ, không phải test độc lập ngoài miền. Protocol và từng truy vấn nằm trong `reports/classifier_retrieval_precision_at_5.json`, tái tạo bằng `scripts/evaluate_classifier_retrieval.py`.
- **Smoke ảnh production:** một ảnh hướng dương không có trong gallery trả 5/5 ảnh hướng dương. Đây là một ca smoke, không thay benchmark.
- **Đánh giá mô tả tiếng Việt:** Precision@5 **100%** trên 10 câu development viết thủ công, hai câu cho mỗi lớp trong 5 loài nổi bật. Kết quả tái tạo bằng `scripts/evaluate_classifier_text_search.py`, lưu tại `reports/classifier_text_search_precision_at_5.json`. Tập nhỏ này chưa được người đánh giá độc lập gán nhãn và không đại diện truy vấn tự nhiên của toàn bộ 103 loài; loài ngoài 5 lớp nổi bật vẫn dùng tên/metadata và weighted lexical fallback.
- **Tham chiếu mô hình tùy chọn:** `reports/retrieval_precision_at_5.json` đo MobileCLIP2 + FAISS trong môi trường nhiều RAM hơn; số liệu đó **không phải** backend ảnh của production Render.

### Hỏi đáp RAG và “Cô làm vườn”

- **Kho tài liệu trong repo:** 8 tệp Markdown tiếng Việt và 2 PDF (`data/kb/`). Hai PDF có 56 trang (K-State, 2019) và 38 trang quét (USDA, 1901); các tài liệu web khác chỉ được liệt kê/liên kết trong `data/kb_sources.md`, không tính là file đã nạp.
- **Số chunk:** 750 chunk được đếm bằng `core.llm.load_chunks()` trên corpus hiện tại (mặc định tối đa 600 ký tự/chunk, overlap 100 ký tự; Markdown tách theo đề mục, PDF tách theo trang). Số chunk không được lưu thành artifact riêng; có thể tái tạo bằng hàm này.
- **30 câu hỏi:** các câu hỏi và tệp nguồn mong đợi nằm trong `data/kb_eval/rag_hit_at_3.json` (6 câu cho mỗi tệp hoa được kiểm tra). `scripts/evaluate_rag.py` gọi đây là bộ câu hỏi đã rà soát, nhưng repo **chưa có** tên người viết, quy trình tạo, hay nguồn gốc từng câu hỏi ngoài nhãn `source`.
- **Câu khó/ngoài phạm vi:** bộ đánh giá riêng cho câu khó hoặc ngoài phạm vi **chưa có**.

## 2. Chỉ số

| Chức năng | Chỉ số có trong repo | Tập và giới hạn diễn giải |
|---|---|---|
| Phân loại ResNet-18 | Accuracy **90,26%**; macro-F1 **91,56%**; weighted-F1 **90,24%**. Precision/recall/F1/support theo lớp có trong báo cáo. | 2.135 ảnh validation, 103 lớp. Validation được dùng chọn checkpoint; test độc lập **chưa có**. Ma trận nhầm lẫn CSV có; ảnh heatmap **chưa có**. |
| Phát hiện YOLO11n | mAP50 **87,04%**; mAP50–95 **68,02%**; precision **81,04%**; recall **81,99%**. | Test 84 ảnh/145 hộp; fine-tune 12 epoch, ảnh 320 px. Đo CPU Intel Core i5-13500H, Torch 2.14.0+cpu, Ultralytics 8.4.165. mAP theo lớp ở bảng dưới và `reports/detector_evaluation.json`. |
| Tìm ảnh bằng ảnh | Production ResNet-feature Precision@5 **91,65%** (206 query); smoke ảnh hướng dương production **5/5**. | Held-out theo đường dẫn nhưng cùng nguồn dữ liệu Flowers; không đại diện ảnh ngoài miền. Xem `reports/classifier_retrieval_precision_at_5.json`. |
| Tìm ảnh bằng mô tả tiếng Việt | Production Precision@5 **100%** (10 query). | Bộ development nhỏ, viết thủ công cho 5 lớp, chưa gán nhãn độc lập; không đại diện truy vấn tự nhiên/toàn bộ 103 loài. Xem `reports/classifier_text_search_precision_at_5.json`. |
| RAG truy xuất nguồn | Hit@3 **30/30 = 100%**. | Đo việc nguồn mong đợi xuất hiện trong 3 nguồn đầu của BM25, **không đo độ đúng/đầy đủ của câu trả lời Gemini**. Đánh giá ngoài phạm vi **chưa đo**. |
| “Cô làm vườn” — chất lượng câu trả lời | Độ đúng câu trả lời, độ an toàn và chất lượng trích dẫn đầu-cuối: **chưa đo**. | Không có bộ đánh giá đáp án sinh trong repo; Hit@3 chỉ đo truy xuất. Gemini là tùy chọn; fallback RAG trích nội dung truy xuất khi chưa bật hoặc khi Gemini không khả dụng. |

Các file bằng chứng: `reports/classifier_evaluation.json`, `reports/classifier_confusion_matrix.csv`, `reports/classifier_per_class.csv`, `reports/detector_evaluation.json`, `reports/classifier_retrieval_precision_at_5.json`, `reports/classifier_text_search_precision_at_5.json`, `reports/rag_hit_at_3.json`.

### Phát hiện — kết quả theo lớp trên test split

| Lớp | Precision | Recall | mAP50 | mAP50–95 |
|---|---:|---:|---:|---:|
| Daisy | 70,66% | 92,10% | 89,43% | 66,82% |
| Dandelion | 88,31% | 100,00% | 97,86% | 87,11% |
| Roses | 84,54% | 60,00% | 80,30% | 55,60% |
| Sunflowers | 80,67% | 75,86% | 80,58% | 62,54% |

Tái tạo phép đo: `.venv/Scripts/python scripts/evaluate_flower_detector.py` (Windows: `\.venv\Scripts\python.exe scripts/evaluate_flower_detector.py`).

## 3. Giới hạn

- Classifier chỉ dự đoán trong 103 nhãn đã huấn luyện; 76 lớp có ít hơn 100 ảnh. Không có test split độc lập, nên số accuracy/F1 hiện có không phải kết quả test độc lập.
- Detector chỉ có bốn lớp được nêu ở mục Dữ liệu; không có lớp “hoa” tổng quát. Ảnh ngoài miền hoặc hoa nhỏ/chồng lấp có thể bị bỏ sót hay khoanh sai.
- Tìm ảnh trả ảnh tương tự theo embedding, không xác nhận danh tính thực vật. Precision@5 của tuyến mô tả tiếng Việt production đạt 100% trên 10 câu development viết thủ công; tập nhỏ này chưa được gán nhãn độc lập và không đại diện truy vấn tự nhiên hoặc toàn bộ 103 loài.
- **Cơ chế “Cô làm vườn”:** endpoint `/api/chat` dùng `RAGChatbot` trong `core/llm.py`: BM25 truy xuất chunk từ `data/kb/`; Gemini chỉ sinh câu trả lời khi `ENABLE_GEMINI_API=1`, có API key và provider khả dụng. Nếu không, backend trả fallback dựa trên đoạn truy xuất và trích nguồn. Vì vậy không phải mọi phản hồi đều do mô hình sinh. Đây không phải mô hình chuyên biệt đã huấn luyện để chẩn đoán bệnh cây. Độ đúng câu trả lời sinh **chưa đo**.
- Corpus chỉ có 10 file, trong đó hai PDF đều về hướng dương; phạm vi và tính cập nhật tài liệu không đồng đều. Bộ 30 câu hỏi chỉ đo tìm đúng nguồn, chưa có tập câu hỏi ngoài phạm vi hoặc chấm đáp án.
- Gợi ý của chatbot chỉ mang tính tham khảo, không thay thế chuyên gia/khuyến nông; không dùng để quyết định cây có độc, ăn/uống được hay điều trị bằng thuốc.

### Tặng hoa — hệ thống quy tắc, không phải mô hình AI

- `data/gift_meanings.json` có 103 mục: 28 loài ứng viên (`gift_ok=true`) và 75 loài chỉ giữ ý nghĩa chung từ `species.json`; tất cả mục hiện `verified=false`. Repo có nguồn bối cảnh văn hoá tổng quát trong `data/kb/y_nghia_tang_hoa.md`, nhưng chưa có nguồn xác minh từng ánh xạ loài–dịp–người nhận; các ánh xạ và lưu ý tập quán vẫn là bản nháp.
- Bộ gợi ý chấm quy tắc theo dịp, người nhận và màu, loại các dịp được đánh dấu tránh, rồi trả tối đa ba phối bó. API `POST /api/gifts/recommend` chỉ đọc JSON cục bộ, không nạp thêm model. Độ đúng gợi ý, mức phù hợp văn hoá và chất lượng bó: **chưa đo**.
- Lời nhắn có thể dùng Gemini qua endpoint chatbot hiện có; khi endpoint lỗi/quota, giao diện chuyển sang ba mẫu offline. Lời nhắn và ý nghĩa không được xem là nguồn văn hoá.
- `data/kb/y_nghia_tang_hoa.md` đưa các bản nháp vào RAG với trích dẫn nội bộ; chatbot phải nói rõ dữ liệu chưa xác minh. Ý nghĩa hoa thay đổi theo vùng miền, tôn giáo, gia đình, màu và quan hệ người tặng/người nhận. Cần hỏi người nhận/gia đình trong tình huống nhạy cảm, nhất là chia buồn/thờ cúng.
- Sổ hoa dùng `localStorage`, không cần đăng nhập và không đồng bộ giữa thiết bị; người dùng có thể xoá dữ liệu. Ảnh thiệp được tạo trong trình duyệt.

## 4. Rủi ro

Dự đoán sai có thể gây nhầm lẫn về loài, độc tính hoặc cách chăm sóc. Tài liệu truy xuất là dữ liệu bên ngoài không tin cậy; prompt có chỉ dẫn bỏ qua lệnh nằm trong tài liệu nhưng không bảo đảm chống mọi prompt injection. Khi Gemini hoạt động, câu hỏi và các đoạn tài liệu liên quan được gửi tới Gemini API. Không đưa API key vào frontend hoặc Git.

## 5. Cách dùng đúng / sai

**Nên:** dùng ảnh rõ, đủ sáng, một chủ thể; xem top-k và confidence như gợi ý; mở nguồn trích dẫn và đối chiếu nguồn thực vật học đáng tin cậy. **Không nên:** coi top-1 là chắc chắn, diễn giải confidence như xác suất đã hiệu chuẩn, xem detector không khoanh vùng là bằng chứng không có hoa, hoặc coi “Cô làm vườn” là chuyên gia chẩn đoán.
