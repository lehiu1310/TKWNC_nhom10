# Nguồn tài liệu cho kho tri thức Vườn Hoa AI

Kho chatbot được biên soạn lại bằng tiếng Việt từ tài liệu khuyến nông, vườn thực vật và hướng dẫn thực vật học có nguồn kiểm chứng. Mỗi tài liệu trong `data/kb/*.md` ghi rõ nguồn ở cuối; nội dung là bản tóm tắt/diễn giải, không phải bản sao nguyên văn. Tài liệu được xuất bản cho khí hậu và mục tiêu trồng khác nhau, vì vậy các con số sản xuất ở Hoa Kỳ không được biến thành khuyến cáo mặc định cho vườn nhà tại Việt Nam.

## Tài liệu có số trang công bố

| Tài liệu gốc | Đơn vị | Số trang | Nội dung được dùng |
|---|---|---:|---|
| [High Plains Sunflower Production Handbook](https://www.southeast.k-state.edu/program_areas/crop_production/sunflower/MF2384.pdf) | K-State Research and Extension | 56 | Đã lưu/lập chỉ mục `data/kb/sunflower_kstate_2019.pdf`; sinh trưởng, gieo trồng, dinh dưỡng, nước, bệnh và quản lý hướng dương quy mô đồng ruộng. Phạm vi vùng High Plains, Hoa Kỳ; cần đối chiếu điều kiện địa phương. |
| [Sunflower Production, Circular 911](https://openprairie.sdstate.edu/extension_circ/478/) | South Dakota Cooperative Extension Service | 11 | Chọn giống, gieo, phân bón, cỏ dại, bệnh, côn trùng và chim hại. |
| [Annual Sunflower Plant Guide](https://plants.sc.egov.usda.gov/DocumentLibrary/plantguide/pdf/cs_hean3.pdf) | USDA Natural Resources Conservation Service | 5 | Đặc điểm và gây trồng hướng dương thường niên; hướng dẫn vùng ôn đới Bắc Mỹ. |
| [Rose Culture](https://ufdcimages.uflib.ufl.edu/IR/00/00/36/05/00001/MG03600.pdf) | University of Florida / IFAS | 7 | Trồng, tưới, dinh dưỡng, tỉa và cắt hoa hồng tại Florida. Tài liệu lưu trữ; cần kiểm tra khuyến cáo hiện hành. |
| [The Sunflower Plant: Its Cultivation, Composition and Uses](https://commons.wikimedia.org/wiki/File:The_sunflower_plant-_its_cultivation,_composition_and_uses_(IA_sunflowerplantit60wile).pdf) | U.S. Department of Agriculture, Division of Chemistry | 38 scanned pages (31 printed pages) | Bản PDF được lưu và lập chỉ mục tại `data/kb/sunflower_usda_1901.pdf`; tư liệu lịch sử về hướng dương. Tác phẩm của cơ quan liên bang Hoa Kỳ, xuất bản năm 1901, được Commons đánh dấu public domain. Không dùng làm hướng dẫn canh tác hiện hành. |

Bốn tài liệu khuyến nông được liên kết ban đầu có tổng **79 trang tham khảo**; hai PDF nằm trong kho chatbot có **94 trang quét đã nạp** (K-State 2019: 56; USDA 1901: 38, tương đương 31 trang in). Không cộng các trang chỉ được liên kết với số trang đã nạp. Hai PDF được chia chunk theo trang và trích dẫn kèm số trang. Handbook K-State tập trung sản xuất hướng dương tại vùng High Plains, Hoa Kỳ; bulletin USDA là tài liệu lịch sử. Chúng không đại diện cho hướng dẫn canh tác phổ quát hoặc điều kiện Việt Nam, và không bao phủ cân bằng cả năm loài.

## Nguồn web bổ sung

- University of Maryland Extension, [Production of Tulips as Cut Flowers](https://extension.umd.edu/resource/production-tulips-cut-flowers): củ, quy trình làm lạnh, sản xuất, thu hoạch và bệnh tulip.
- Illinois Extension, [Shasta Daisy](https://extension.illinois.edu/flowers/shasta-daisy): mùa nở và chăm sóc Shasta daisy ở Illinois.
- UF/IFAS, [Shasta Daisy](https://ask.ifas.ufl.edu/publication/FP127): điều kiện trồng, nhân giống, sâu bệnh và độ bền hoa cắt.
- Purdue Extension, [Chrysanthemums](https://ag.purdue.edu/department/hla/extension/extension-publications-library/ext-pubs/ho-77.html): nhóm giống, nhân giống, đất, ánh sáng, thời điểm nở và chăm sóc cúc.
- Penn State Extension, [Dandelion as a Landscape Weed](https://extension.psu.edu/dandelion-as-a-landscape-weed): nhận dạng và quản lý bồ công anh/cỏ dại trong cảnh quan.
- UF/IFAS, [Roses for Florida](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/roses-for-florida/): khác biệt giống hồng và tác động của khí hậu nóng ẩm.

## Giới hạn sử dụng nguồn

Các nguồn được dùng để xây tri thức tham khảo, không phải bằng chứng mọi khuyến cáo áp dụng cho tất cả tỉnh thành. Phần mềm không chẩn đoán bệnh, xác nhận giống, đưa liều thuốc, hay xác định cây an toàn để ăn. Khi tài liệu không trả lời câu hỏi, chatbot cần nói rõ chưa có thông tin. Nguồn gốc và ngày truy cập cần được kiểm tra lại trước khi dùng làm khuyến cáo canh tác chuyên môn.
