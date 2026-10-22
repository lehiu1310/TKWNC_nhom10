# Kiểm toán màu hoa

Màu ảnh được ước lượng cục bộ từ vùng giữa ảnh, loại pixel xanh lá và ưu tiên pixel bão hòa. Đây là cảnh báo để rà soát bằng mắt, không phải nhãn chuẩn.
Ảnh hưởng sản phẩm: `species.json` không bị sửa. Renderer chỉ dùng màu ảnh làm gợi ý khi cụm màu trung tâm có ít nhất 500 pixel và màu không thuộc dải xanh lá; mẫu nhỏ hoặc màu lá bị bỏ qua.
Vùng lấy mẫu chuẩn hóa: x=30%–70%, y=20%–68%. Ngưỡng lệch hue: 58°.
Đã phân tích 103 ảnh; 53 loài là cảnh báo lệch màu tiềm năng (ngưỡng hue >58°). Trong đó 37 mẫu đủ điều kiện kích thước để màu ảnh được dùng làm gợi ý dựng 3D; 16 mẫu dưới 500 pixel bị bỏ qua. Cảnh báo vẫn cần duyệt bằng mắt vì crop giữa có thể chứa nhiều hoa hoặc nền.

| Loài | Màu species.json | Màu ước lượng từ ảnh | Lệch hue | Mẫu màu | Xử lý trong 3D |
|---|---|---|---:|---:|---|
| Tulip (`tulips`) | `#9B7EDE` | `#991C45` | 83.9° | 242 | bỏ qua mẫu nhỏ |
| Anh thảo hồng (`pink-primrose`) | `#5BAE6B` | `#D0C742` | 77.6° | 353 | bỏ qua mẫu nhỏ |
| Kế cầu (`globe-thistle`) | `#5BAE6B` | `#7B805A` | 65.6° | 163 | bỏ qua mẫu nhỏ |
| Cúc Gaillardia (`blanket-flower`) | `#9B7EDE` | `#85180B` | 107.9° | 1010 | gợi ý màu ảnh |
| Đăng tiêu (`trumpet-creeper`) | `#5BAE6B` | `#C73324` | 125.6° | 1947 | gợi ý màu ảnh |
| Khoản đông hoa (`colt-s-foot`) | `#5BAE6B` | `#DEAC2B` | 89.6° | 1673 | gợi ý màu ảnh |
| Protea hoàng đế (`king-protea`) | `#5BAE6B` | `#A5504A` | 125.6° | 530 | gợi ý màu ảnh |
| Kế gai (`spear-thistle`) | `#FFC93C` | `#E774DE` | 97.4° | 124 | bỏ qua mẫu nhỏ |
| Cầu hoa vàng (`globe-flower`) | `#5BAE6B` | `#DCC510` | 77.6° | 1941 | gợi ý màu ảnh |
| Ly Peru (`peruvian-lily`) | `#5BAE6B` | `#9C5A3F` | 113.6° | 761 | gợi ý màu ảnh |
| Hoa cát cánh (`balloon-flower`) | `#FF6F91` | `#4C347A` | 87.8° | 1076 | gợi ý màu ảnh |
| Hoa scabiosa (`pincushion-flower`) | `#FFC93C` | `#AA83D0` | 133.4° | 1140 | gợi ý màu ảnh |
| Dạ hương nho (`grape-hyacinth`) | `#5BAE6B` | `#647ECA` | 90.4° | 649 | gợi ý màu ảnh |
| Anh túc đỏ (`corn-poppy`) | `#9B7EDE` | `#CB0710` | 95.9° | 1596 | gợi ý màu ảnh |
| Atisô (`artichoke`) | `#FFC93C` | `#8C45D1` | 133.4° | 576 | gợi ý màu ảnh |
| Chuông Canterbury (`canterbury-bells`) | `#9B7EDE` | `#9EB944` | 179.9° | 77 | bỏ qua mẫu nhỏ |
| Cẩm chướng chùm (`sweet-william`) | `#FFC93C` | `#C5325E` | 61.4° | 1577 | gợi ý màu ảnh |
| Phlox vườn (`garden-phlox`) | `#5BAE6B` | `#D960B4` | 173.6° | 479 | bỏ qua mẫu nhỏ |
| Kế biển Alpine (`alpine-sea-holly`) | `#5BAE6B` | `#7866A6` | 126.4° | 587 | gợi ý màu ảnh |
| Lan Cattleya môi ruby (`ruby-lipped-cattleya`) | `#FFC93C` | `#D359E1` | 109.4° | 624 | gợi ý màu ảnh |
| Hoa Cape (`cape-flower`) | `#5BAE6B` | `#D294A7` | 149.6° | 1327 | gợi ý màu ảnh |
| Astrantia (`great-masterwort`) | `#5BAE6B` | `#7D373F` | 137.6° | 751 | gợi ý màu ảnh |
| Đậu thơm (`sweet-pea`) | `#5BAE6B` | `#BC2A1D` | 125.6° | 1820 | gợi ý màu ảnh |
| Hồng mùa chay (`lenten-rose`) | `#FFC93C` | `#9B304F` | 61.4° | 1342 | gợi ý màu ảnh |
| Lay ơn (`sword-lily`) | `#6B9DD4` | `#E1CD53` | 157.4° | 576 | gợi ý màu ảnh |
| Trạng nguyên (`poinsettia`) | `#FFC93C` | `#E1839F` | 61.4° | 693 | gợi ý màu ảnh |
| Hoa wallflower (`wallflower`) | `#9B7EDE` | `#EBAD08` | 143.9° | 848 | gợi ý màu ảnh |
| Vạn thọ (`marigold`) | `#5BAE6B` | `#DABF19` | 77.6° | 2029 | gợi ý màu ảnh |
| Dạ yên thảo (`petunia`) | `#FFC93C` | `#AC5BA2` | 97.4° | 569 | gợi ý màu ảnh |
| Viola ba màu (`wild-pansy`) | `#9B7EDE` | `#CABE22` | 155.9° | 357 | bỏ qua mẫu nhỏ |
| Phong lữ thảo (`pelargonium`) | `#FF8A5B` | `#D6A5EB` | 95.2° | 983 | gợi ý màu ảnh |
| Thược dược Bishop of Llandaff (`bishop-of-llandaff`) | `#5BAE6B` | `#C51B24` | 137.6° | 2177 | gợi ý màu ảnh |
| Gaura (`gaura`) | `#FF6F91` | `#535922` | 80.2° | 87 | bỏ qua mẫu nhỏ |
| Hải quỳ Nhật (`japanese-anemone`) | `#5BAE6B` | `#BF56B2` | 174.4° | 1172 | gợi ý màu ảnh |
| Diên vĩ râu (`bearded-iris`) | `#FFC93C` | `#581D46` | 85.4° | 395 | bỏ qua mẫu nhỏ |
| Đỗ quyên (`azalea`) | `#FFC93C` | `#DD5175` | 61.4° | 1258 | gợi ý màu ảnh |
| Cà độc dược (`thorn-apple`) | `#9B7EDE` | `#9CA463` | 167.9° | 366 | bỏ qua mẫu nhỏ |
| Lạc tiên (`passion-flower`) | `#5BAE6B` | `#9BA92A` | 65.6° | 449 | bỏ qua mẫu nhỏ |
| Hồng môn (`anthurium`) | `#5BAE6B` | `#D8253D` | 137.6° | 350 | bỏ qua mẫu nhỏ |
| Ông lão (`clematis`) | `#5BAE6B` | `#7E1735` | 149.6° | 1474 | gợi ý màu ảnh |
| Dâm bụt (`hibiscus`) | `#5BAE6B` | `#E3313B` | 137.6° | 1352 | gợi ý màu ảnh |
| Sứ Thái (`desert-rose`) | `#FFC93C` | `#E5245D` | 61.4° | 256 | bỏ qua mẫu nhỏ |
| Mộc lan (`magnolia`) | `#5BAE6B` | `#A33D60` | 149.6° | 1042 | gợi ý màu ảnh |
| Anh thảo Cyclamen (`cyclamen`) | `#5BAE6B` | `#97052F` | 149.6° | 1623 | gợi ý màu ảnh |
| Ô đầu (`monkshood`) | `#FFC93C` | `#403589` | 157.4° | 586 | gợi ý màu ảnh |
| Dong riềng cảnh (`canna-lily`) | `#5BAE6B` | `#F37F0C` | 101.6° | 325 | bỏ qua mẫu nhỏ |
| Huệ tây (`hippeastrum`) | `#FFC93C` | `#E7779A` | 61.4° | 276 | bỏ qua mẫu nhỏ |
| Bạc hà ong (`bee-balm`) | `#9B7EDE` | `#A72A21` | 107.9° | 1185 | gợi ý màu ảnh |
| Rêu cầu (`ball-moss`) | `#9B7EDE` | `#9F583B` | 119.9° | 1100 | gợi ý màu ảnh |
| Mao địa hoàng (`foxglove`) | `#FFC93C` | `#DF70A6` | 73.4° | 408 | bỏ qua mẫu nhỏ |
| Hoa giấy (`bougainvillea`) | `#5BAE6B` | `#B60E20` | 137.6° | 1092 | gợi ý màu ảnh |
| Cẩm quỳ (`mallow`) | `#5BAE6B` | `#C1180E` | 125.6° | 999 | gợi ý màu ảnh |
| Dạ yên thảo Mexico (`mexican-petunia`) | `#FFC93C` | `#652C9F` | 133.4° | 910 | gợi ý màu ảnh |
