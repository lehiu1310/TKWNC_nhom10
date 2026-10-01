# TKWNC_nhom10 — Vườn Hoa AI

**Demo trực tiếp:** https://tkwnc-nhom10.vercel.app/  
**Backend demo (Render):** https://tkw-nhom10-api.onrender.com  
**Health check:** https://tkw-nhom10-api.onrender.com/api/health

Website tra cứu 103 loài hoa trong bộ dữ liệu nhận diện, với bốn chức năng AI lấy từ notebook môn học: phân loại ảnh, phát hiện đối tượng, tìm kiếm ảnh bằng chữ hoặc ảnh, và chatbot RAG tiếng Việt. ResNet-18 có 103 nhãn; trang chủ chọn 5 loài làm câu chuyện nổi bật, còn Bách khoa và trang chi tiết bao phủ toàn bộ 103 loài.

## Kiến trúc

- `core/`: suy luận dùng chung — ResNet-18 (103 nhãn), YOLO11, MobileCLIP2-S0 + FAISS và Gemini + RAG với truy xuất BM25 nhẹ (có thể chọn Qwen local).
- `api/`: FastAPI cho web và Streamlit. Mô hình được nạp lần đầu khi mở tính năng tương ứng để trang/API khởi động nhanh.
- `web/`: React + Vite, trải nghiệm responsive theo chủ đề vườn hoa.
- `data/kb/`: tài liệu tiếng Việt cho chatbot; mỗi chủ đề bắt đầu bằng tiêu đề `## `.
- `data/kb_eval/rag_hit_at_3.json`: 30 câu hỏi đánh giá nguồn truy xuất RAG.
- `data/species.json`: dữ liệu của 103 loài, khớp với 103 nhãn trong `artifacts/classifier/classes.json`.
- `data/display_images.json`: nguồn ảnh trưng bày chất lượng cao cho 5 loài nổi bật trên trang chủ; các loài còn lại dùng ảnh đại diện trong dữ liệu Flowers.

## Cần cài

- Python 3.11
- Node.js 20.19 trở lên
- Kết nối Internet lần đầu để tải Flowers và trọng số mô hình
- GPU giúp khởi tạo nhanh hơn; CPU vẫn chạy được nhưng thời gian chuẩn bị/inference lâu hơn

## Demo và chạy nhanh trong 15 phút

Cách nhanh nhất là mở [demo trực tiếp](https://tkwnc-nhom10.vercel.app/); không cần cài gì. Nếu cần clone và chạy giao diện trên máy, chỉ cần Git, Node.js 22 LTS và Corepack (đi kèm Node). Lệnh dưới đây dùng backend Render đã deploy nên **không cần cài Python, tải model hay tạo khóa Gemini**:

```powershell
git clone https://github.com/lehiu1310/TKWNC_nhom10.git
cd TKWNC_nhom10/web
corepack pnpm install --frozen-lockfile
$env:VITE_API_BASE_URL="https://tkw-nhom10-api.onrender.com"
corepack pnpm dev -- --host 0.0.0.0 --port 5175
```

Mở `http://localhost:5175`. Khi dùng chức năng AI lần đầu, Render free có thể cần khởi động lại sau thời gian không hoạt động; chờ cold start rồi thử lại. Bộ cài local đầy đủ cho backend ở mục tiếp theo cần tải dữ liệu/model và có thể lâu hơn 15 phút; cách trên là quy trình clone/chạy nhanh để xem đầy đủ giao diện và gọi backend đã deploy.

## Chạy lần đầu trên Windows

Mở PowerShell ở thư mục dự án:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python scripts/prepare_flowers102.py --epochs 3
cd web
pnpm install
pnpm run build
cd ..
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

`prepare_flowers102.py` tải Oxford Flowers 102 (8.189 ảnh, 102 lớp), ghép dữ liệu để fine-tune ResNet-18 trên 11.859 ảnh với 103 nhãn. Bách khoa có đủ 103 mục khớp với các nhãn phân loại; năm loài trên trang chủ chỉ là nhóm nổi bật. MobileCLIP2-S0 + FAISS dùng tối đa 12 ảnh đại diện mỗi nhãn (1.236 ảnh hiện tại); index đi cùng mã nguồn và `encoder.json` xác nhận model dùng để tạo vector. Danh sách lớp Oxford chủ yếu gồm hoa phổ biến ở Anh, không đại diện cho mọi loài hoa trên thế giới. Chuẩn bị dữ liệu/trọng số là bước một lần, cần Internet và vài GB dung lượng; thời gian trên CPU phụ thuộc máy và có thể vượt 15 phút. YOLO11, MobileCLIP2-S0 và mô hình dịch Việt–Anh được tải khi mở chức năng lần đầu. Chatbot dùng BM25 trên tài liệu tiếng Việt để giảm RAM, Gemini yêu cầu `GOOGLE_API_KEY`/`GEMINI_API_KEY`; `LLM_PROVIDER=hf_local` dùng Qwen local và có thể đổi model bằng `LLM_MODEL`.

Khi phát triển React riêng, mở **hai terminal và giữ cả hai chạy cùng lúc**:

1. Terminal backend, tại thư mục gốc: `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000`.
2. Terminal frontend: `cd web` rồi `pnpm exec vite --host 0.0.0.0 --port 5175`.

Mở địa chỉ Vite vừa in ra (mặc định ép cổng `5175` theo lệnh trên). Vite proxy `/api` tới FastAPI ở `http://localhost:8000`, vì vậy cấu hình mặc định không cần CORS. Nếu frontend gọi trực tiếp backend, đặt `VITE_API_BASE_URL=http://localhost:8000` trong `web/.env.local`; backend cho phép origin localhost ở cổng 5173 và 5175 theo `CORS_ORIGINS`. Có thể dùng `VITE_API_URL` như tên cũ.

## Bốn chức năng

| Tên trên web | Mô hình | Dữ liệu / giới hạn |
|---|---|---|
| Kính lúp hoa | ResNet-18 | 103 lớp: Oxford Flowers 102 + lớp tulip từ TF Flowers |
| Mắt thần vườn | YOLO11n fine-tuned | Bản mã nguồn mặc định dùng `artifacts/detector/flower_yolo11n.pt` (4 lớp hoa). Dịch vụ Render live lần kiểm tra gần nhất vẫn trả nhãn COCO cũ; xem bảng tình trạng deploy bên dưới. |
| Album hoa | MobileCLIP2-S0 + FAISS | Tìm ảnh trong bộ Flowers; câu tiếng Việt được dịch cục bộ sang tiếng Anh trước khi mã hoá |
| Cô làm vườn | Gemini API (mặc định) + BM25 | RAG truy xuất tám tài liệu hoa trong `data/kb/`; Qwen local là tùy chọn |

API gồm 10 endpoint: `/api/health`, `/api/species`, `/api/species/{id}/image`, `/api/classify`, `/api/detect`, `/api/search/text`, `/api/search/image`, `/api/gallery/{id}`, `/api/chat` (SSE), `/api/chat/sync`. Endpoint `/api/species` hỗ trợ `limit` và `offset`; `/api/health` có thể lọc trạng thái bằng `?model=classifier`.

## Cấu hình

Các biến môi trường backend chính: `ENABLED_MODELS`, `LLM_PROVIDER` (`gemini` mặc định hoặc `hf_local`), `GEMINI_MODEL`, `GOOGLE_API_KEY` (hoặc `GEMINI_API_KEY`), `LLM_MODEL`, `CLIP_MODEL` (mặc định `MobileCLIP2-S0`), `CLIP_PRETRAINED` (mặc định `dfndr2b`), `TRANSLATION_MODEL`, `EMBED_MODEL`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`, `APP_ROOT`. Không đặt khóa Gemini trong frontend. Frontend hỗ trợ `VITE_API_BASE_URL` (ưu tiên) và `VITE_API_URL`; để trống thì dùng proxy `/api` của Vite tới cổng 8000.

Model Card và giới hạn/chỉ số hiện có: [MODEL_CARD.md](MODEL_CARD.md). Chạy lại metric ResNet trên validation split bằng `python scripts/evaluate_classifier.py`; đo image retrieval bằng query không có trong index với `python scripts/evaluate_retrieval.py --queries-per-class 2`; đo RAG Hit@3 trên bộ 30 câu hỏi bằng `python scripts/evaluate_rag.py`. Chạy API tests bằng `python -m pip install -r requirements-test.txt` rồi `python -m pytest -q`; bộ test dùng model giả nên không tải checkpoint hay cần GPU. Bộ test bao phủ 10 endpoint, mỗi endpoint có tình huống hợp lệ, lỗi yêu cầu (400) và lỗi schema (422). GitHub Actions chạy cùng lệnh khi push/pull request.

## Bằng chứng theo rubric 10.2 — mức cơ bản

| Ứng dụng | Tiến độ mức cơ bản | Bằng chứng / phần còn thiếu |
|---|---|---|
| Phân loại | Đạt theo dữ liệu và báo cáo hiện có | 103 lớp; năm lớp hoa nổi bật đều có trên 100 ảnh (daisy 700, dandelion 947, roses 761, sunflowers 792, tulips 799). Accuracy 90,26%, macro-F1 91,56%, weighted-F1 90,24%; confusion matrix tại `reports/classifier_confusion_matrix.csv`. Split validation đã dùng chọn checkpoint, vì vậy không phải test độc lập. |
| Phát hiện | Đạt mức cơ bản theo quy trình huấn luyện/đánh giá hiện có | Fine-tune YOLO11n trên 831 ảnh có nhãn bounding box (664 train / 83 validation / 84 test, 4 lớp, 1.280 hộp; CC Apache-2.0); test mAP50 = 0,7306, precision = 0,6641, recall = 0,7411 sau 3 epoch. Kết quả thật tại `reports/detector_evaluation.json`; một ảnh hoa hồng thử trực tiếp trả về hộp `roses` cùng một false positive `daisy`. Chưa có lớp tulip và chưa đánh giá ngoài phân phối. |
| Tìm ảnh | Đạt theo kho ảnh và phép đo retrieval | FAISS có 1.236 ảnh (>1.000). Precision@5 = 0,8592 trên 206 ảnh query held-out theo đường dẫn, cùng nguồn Flowers; báo cáo tại `reports/retrieval_precision_at_5.json`. API hỗ trợ lọc kết quả theo nhãn (tham số `label`). |
| Chatbot RAG | Đạt bước đánh giá truy xuất; chưa đạt điều kiện dữ liệu 20 trang | Hit@3 = 29/30 = 96,67% trên câu hỏi nội bộ tại `data/kb_eval/rag_hit_at_3.json`; kết quả ở `reports/rag_hit_at_3.json`. Kho hiện chỉ có 8 tài liệu Markdown ngắn, chưa phải bộ tài liệu thật ≥20 trang như rubric yêu cầu; điểm Hit@3 đo việc tìm đúng file nguồn, không chấm độ đúng câu trả lời sinh ra. |

### Thử nghiệm mức nâng cao đã chạy

- **Phân loại + ONNX:** cùng split stratified 82/18, seed 42, 11.859 ảnh/103 lớp. ResNet-18: accuracy 90,26%, macro-F1 91,56%, checkpoint 44.995.147 byte, latency PyTorch CPU p50/p95 69,18/75,20 ms. MobileNetV3-Small (ImageNet pretrained, fine-tune feature block cuối + head trong 3 epoch): accuracy 65,90%, macro-F1 57,45%, checkpoint 6.626.901 byte, p50/p95 17,90/20,20 ms. MobileNet nhẹ/nhanh hơn nhưng giảm accuracy khoảng 24,36 điểm; chưa thay model production. ResNet đã export ONNX opset 17: 44.907.914 byte; sai khác logits tuyệt đối lớn nhất 5,61e-6 trên 64 ảnh. Trong cùng lượt đo, ONNX Runtime CPU p50/p95 73,06/77,70 ms so với PyTorch 68,96/74,37 ms, nên chưa nhanh hơn ở cấu hình máy này. Đây là validation protocol dùng khi chọn checkpoint, không phải test độc lập. Kết quả/script: `reports/classifier_architecture_comparison.json`, `scripts/compare_classifier_architectures.py`; model/graph được lưu trong `artifacts/comparison/`.
- **Grad-CAM:** API `/api/classify` nhận field tùy chọn `explain=true` và trả overlay giải thích. Ca thử ảnh hoa hồng trả top-1 `roses` 90,37%; ảnh overlay kiểm tra trực quan tại [`reports/gradcam_rose_example.jpg`](reports/gradcam_rose_example.jpg). Heatmap là giải thích xấp xỉ, không phải bằng chứng mô hình suy luận đúng.
- **FAISS Flat vs HNSW:** `reports/faiss_index_comparison.json` ghi phép đo trên 1.236 vector, 206 query lấy mẫu cố định, Intel Core i5-13500H / Python 3.11.9 / FAISS 1.15.1. HNSW (`M=32`, `efSearch=64`) có Recall@5 so với Flat = 1,0 và cùng Precision@5 cùng nhãn = 0,8427; p50/p95 tìm trong index là 0,133/0,400 ms so với Flat 0,098/0,194 ms; HNSW chiếm 2.867.154 byte so với Flat 2.531.373 byte. Đây là query lấy từ vectors đã index để đo độ xấp xỉ, không phải tập query held-out; vì kho chỉ có 1.236 ảnh nên kết quả ủng hộ giữ Flat. Benchmark không tính thời gian encoder hoặc network.
- **Phát hiện webcam:** giao diện có đường xử lý webcam từng frame nối tiếp, đo FPS thực tế và đếm track cắt vạch dọc. Chưa xác nhận luồng camera trên thiết bị người dùng; lần đo Render detect gần nhất mất 73,51 giây/ảnh và backend còn trả nhãn COCO cũ, nên chưa thể coi phần này chạy mượt trên production.
- **RAG nâng cao:** chunk theo mục có overlap tối đa 100 ký tự và lexical rerank sau BM25; Hit@3 vẫn 29/30. Chưa có evaluator tự động độ đúng câu trả lời, reranker neural hoặc kho tài liệu thật ≥20 trang (hiện 8 file ngắn).
- **Chưa hoàn thành nâng cao:** detector webcam chưa đạt FPS thực tế để demo mượt; retrieval hiện dịch tiếng Việt sang tiếng Anh chứ chưa dùng CLIP đa ngôn ngữ cross-modal; classifier chưa có OOD detector/calibrated uncertainty; RAG chưa chấm tự động độ đúng câu trả lời. Những phần đã có code nhưng chưa deploy/benchmark live không được tính là đã đạt trên production.

Tái tạo phép so sánh classifier/ONNX (cần dataset Flowers đã chuẩn bị và các gói ONNX trong `requirements-benchmark.txt`):

```powershell
python -m pip install -r requirements-benchmark.txt
python scripts/compare_classifier_architectures.py --epochs 3
```

Lệnh này fine-tune MobileNetV3-Small, đánh giá ResNet/MobileNet trên cùng validation split, export ResNet ONNX và ghi `reports/classifier_architecture_comparison.json`.

## Hồ sơ nộp bài 10.3

- Báo cáo (giới hạn nội dung theo cấu trúc 8 trang): [`reports/bao_cao_do_an.md`](reports/bao_cao_do_an.md)
- Phiên bản mã nguồn: tag [`v1.0`](https://github.com/lehiu1310/TKWNC_nhom10/tree/v1.0)

Video và ảnh chụp màn hình cần được ghi trực tiếp từ bản demo tại thời điểm nộp; tài liệu không giả lập ảnh hoặc kết quả chưa xác nhận trên deploy.

Các số liệu trên là kết quả đo; dòng “chưa đạt” không được xem là đạt chỉ vì API hoặc giao diện đang chạy.

Để tái tạo fine-tune detector: tải dataset Apache-2.0 rồi tạo split YOLO cố định seed và train (CPU, thời gian tuỳ máy):

```powershell
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Weirdo-329/flower-detection-dataset', repo_type='dataset', local_dir='data/detection_flowers')"
python scripts/prepare_flower_detection.py --seed 42
python scripts/train_flower_detector.py --epochs 3 --imgsz 320 --batch 4
```

Báo cáo hiện tại dùng split test 84 ảnh; không dùng test set để chọn checkpoint. Dữ liệu được lấy từ [Hugging Face dataset card](https://huggingface.co/datasets/Weirdo-329/flower-detection-dataset) (Apache-2.0). Trọng số fine-tune mặc định nằm tại `artifacts/detector/flower_yolo11n.pt` qua Git LFS.

## Hiệu năng đã đo trên backend deploy

Đo ngày **30/09/2026** bằng Locust 2.46.6 tới Render, 1 người dùng đồng thời, ảnh hoa hồng mẫu, 102 request phân loại: 0 lỗi. Phần cứng của dịch vụ là Render Free tại Singapore, giới hạn **0,15 CPU và 512 MB RAM**. Log ứng dụng ghi process peak RSS **423,3 MB** khi classifier đã nạp (`API_PERF`, Python `resource.getrusage`; đây là RSS cực đại của process, không phải biểu đồ RAM toàn container của Render). Kết quả p50/p95 tính từ thời gian phản hồi HTTP:

| Endpoint | Số request | Lỗi | p50 | p95 | Trung bình | Process peak RSS |
|---|---:|---:|---:|---:|---:|---:|
| `POST /api/classify` | 102 | 0 | 3,90 s | 4,50 s | 3,87 s | 423,3 MB |
| `POST /api/detect` | 51 | 0 | 38,74 s | 55,45 s | 43,52 s | 506,2 MB |

Detector được đo bằng Locust 2.46.6 trong ba lượt một người dùng, cùng ảnh hoa hồng; tổng cộng 51 request, 0 lỗi. p50/p95 trong bảng được tính theo nearest-rank từ 51 độ trễ được tái dựng từ cumulative response-time history của Locust. Chi tiết từng request ở [`reports/render-detect_samples.csv`](reports/render-detect_samples.csv), tổng hợp ba lượt ở [`reports/render-detect_runs.csv`](reports/render-detect_runs.csv), và số liệu gộp ở [`reports/render-detect_stats.csv`](reports/render-detect_stats.csv). Đây là phép đo đơn người dùng trên gói CPU miễn phí, không đại diện tải đồng thời cao. Có một lần cold start 130,27 giây; p95 toàn mẫu là 55,45 giây. Process peak RSS cao nhất ghi trong log Render là 506,2 MB trên giới hạn container 512 MB. Kiểm tra trước commit `bd4bd32` ngày 01/10/2026 cho thấy `/api/health` trả `status: ok`, còn `/api/detect` mất 73,51 giây và trả nhãn COCO `vase`, `cup`, `potted plant`. Sau khi push `bd4bd32`, health tiếp tục trả `status: ok`; một ảnh hoa hồng kiểm tra mất 57,62 giây nhưng không có detection. Vì endpoint khi đó chưa trả mã revision và phép thử mới không tạo hộp nào, chưa đủ bằng chứng xác định model production hiện tại hoặc tuyên bố detector hoa đã chạy đúng trên live. Health endpoint mới sẽ trả trường `revision` để đối chiếu commit sau lần deploy kế tiếp. Kết quả OOM của Album hoa thuộc bản CLIP ViT-B/32 cũ. MobileCLIP2 và detector hoa đã qua kiểm tra cục bộ; cần xác nhận revision và benchmark live trước khi kết luận search/detect đã cập nhật. `POST /api/chat/sync` từng trả 503 vì Render chưa được cấu hình `GOOGLE_API_KEY`; log ghi rõ `Thiếu GOOGLE_API_KEY (hoặc GEMINI_API_KEY) để dùng Gemini.` Retriever chatbot đã chuyển sang BM25 để tránh nạp thêm MiniLM, nhưng chưa thể đo response thành công cho đến khi thêm secret Gemini vào Render.

Có thể chạy lại bằng `python -m pip install -r requirements-benchmark.txt`, đặt `FLOWER_TEST_IMAGE` trỏ tới ảnh hoa rồi chọn task Locust cần đo bằng `--tags classify`, `--tags detect`, `--tags search-image` hoặc `--tags chat`.

Các checkpoint và FAISS index cần cho demo được theo dõi bằng Git LFS (xem `.gitattributes`); ảnh gốc và cache Hugging Face không nằm trong repo. Nếu clone thủ công cần tải đầy đủ LFS objects, chạy `git lfs pull`. Dockerfile đóng gói `artifacts/` và `data/` vào image.

## Docker

Image dùng cổng 7860. Chạy `python scripts/prepare_flowers102.py --epochs 3` trước khi build để Docker nhận dataset hoa, checkpoint phân loại và chỉ mục tìm kiếm, sau đó:

```bash
docker build -t tkw-nhom10 .
docker run --rm -p 7860:7860 tkw-nhom10
```
