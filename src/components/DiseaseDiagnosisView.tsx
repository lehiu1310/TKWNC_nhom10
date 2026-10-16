import React, { useState } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  Upload,
  Sparkles,
  ShieldAlert,
  Sprout,
  HeartPulse,
  Pill,
  Droplet,
  Bot,
} from 'lucide-react';

interface DiseaseDiagnosisViewProps {
  onAskChatbot: (question: string) => void;
}

interface PlantDisease {
  id: string;
  name_vi: string;
  scientific: string;
  severity: 'high' | 'medium' | 'low';
  affected_species: string[];
  symptoms: string[];
  cause: string;
  organic_treatment: string[];
  prevention: string[];
  sample_img: string;
}

const COMMON_DISEASES: PlantDisease[] = [
  {
    id: 'powdery_mildew',
    name_vi: 'Bệnh Phấn Trắng',
    scientific: 'Podosphaera pannosa / Erysiphales',
    severity: 'medium',
    affected_species: ['Hoa hồng', 'Cúc họa mi', 'Thược dược', 'Hồng môn'],
    symptoms: [
      'Lớp bột trắng mịn như phấn phủ trên mặt lá non, chồi hoa và cánh hoa.',
      'Lá non bị biến dạng cong queo, chồi hoa teo tóp không thể nở.',
      'Lá chuyển vàng và rụng sớm nếu không xử lý kịp thời.',
    ],
    cause: 'Độ ẩm cao kết hợp thiếu ánh sáng nắng và không khí ẩm tù đọng vào ban đêm.',
    organic_treatment: [
      'Pha 1 thìa cà phê Baking Soda + vài giọt dầu ăn + 1 lít nước, phun ướt đều 2 mặt lá lúc trời râm.',
      'Sử dụng dung dịch sữa tươi pha loãng với nước tỷ lệ 1:9 phun vào buổi sáng để lợi khuẩn ức chế nấm.',
      'Phun tinh dầu Neem Oil sinh học 5ml/lít nước định kỳ 5 ngày/lần.',
    ],
    prevention: [
      'Tỉa bỏ cành tăm, lá già dưới gốc để tạo độ thông thoáng gió.',
      'Tưới nước sát gốc vào sáng sớm, tuyệt đối không tưới đẫm lá qua đêm.',
    ],
    sample_img: 'https://images.unsplash.com/photo-1598880940080-ff9a29891b85?w=600&auto=format&fit=crop',
  },
  {
    id: 'black_spot',
    name_vi: 'Bệnh Đốm Đen Lá',
    scientific: 'Diplocarpon rosae',
    severity: 'high',
    affected_species: ['Hoa hồng', 'Tulip', 'Hoa cúc', 'Cẩm chướng'],
    symptoms: [
      'Các đốm tròn màu nâu đen viền răng cưa xuất hiện trên phiến lá già.',
      'Xung quanh vết đốm bị vàng úa lan rộng, lá rụng hàng loạt chỉ còn trơ cành.',
    ],
    cause: 'Bào tử nấm lây lan qua giọt nước mưa hoặc nước tưới đọng lại trên mặt lá quá 7 giờ.',
    organic_treatment: [
      'Ngắt bỏ và thu gom toàn bộ lá bệnh đem tiêu hủy (không ủ rác phân xanh).',
      'Phun nước tỏi ớt ngâm giấm pha loãng tỷ lệ 1:20 để sát khuẩn tự nhiên.',
      'Dùng Nano Bạc hoặc Booc-đô (Bordeaux mixture) phun phòng ngừa cành.',
    ],
    prevention: [
      'Kê chậu hoa cao cách mặt đất tối thiểu 15cm tránh bào tử bắn ngược.',
      'Tăng cường phân bón Kali và Silic giúp thành tế bào lá dày dặn, cứng cáp.',
    ],
    sample_img: 'https://images.unsplash.com/photo-1596726696467-20a6ed79b50b?w=600&auto=format&fit=crop',
  },
  {
    id: 'root_rot',
    name_vi: 'Bệnh Thối Rễ & Thối Củ Do Úng Nước',
    scientific: 'Phytophthora & Pythium spp.',
    severity: 'high',
    affected_species: ['Hoa Tulip', 'Hoa Sen đá', 'Lan hồ điệp', 'Hoa bồ công anh'],
    symptoms: [
      'Cây héo rũ dù đất vẫn ướt đẫm nước.',
      'Đáy thân mềm nhũn, củ chuyển sang màu nâu đen bốc mùi hôi chua.',
      'Rễ cây bị thối mủn, tuột vỏ khi nhổ nhẹ.',
    ],
    cause: 'Đất trồng bị nén chặt không thoát nước, tưới nước quá nhiều làm rễ thiếu oxy bị ngạt.',
    organic_treatment: [
      'Lập tức nhổ cây ra khỏi chậu, rửa sạch đất bẩn bám quanh rễ.',
      'Dùng kéo khử trùng cắt bỏ toàn bộ phần rễ đen thối, bôi vôi hoặc bột quế vào vết cắt.',
      'Ngâm rễ trong dung dịch kích rễ sinh học có nấm đối kháng Trichoderma 15 phút rồi trồng vào đất mới khô ráo.',
    ],
    prevention: [
      'Trộn giá thể thoát nước tốt: 40% đất + 30% xơ dừa + 20% đá perlite/tro trấu + 10% phân trùn quế.',
      'Chỉ tưới khi mặt đất se khô từ 2-3cm.',
    ],
    sample_img: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&auto=format&fit=crop',
  },
  {
    id: 'spider_mites',
    name_vi: 'Bọ Trĩ & Nhện Đỏ Hút Nhựa',
    scientific: 'Tetranychidae & Frankliniella occidentalis',
    severity: 'medium',
    affected_species: ['Hoa hồng', 'Hướng dương', 'Đồng tiền', 'Cát cánh'],
    symptoms: [
      'Mặt dưới lá xuất hiện mạng tơ li ti, có các đốm trắng bạc li ti như kim châm.',
      'Nụ hoa bị xoăn tít, cánh hoa có vệt thâm đen cháy sém không bung nở được.',
    ],
    cause: 'Thời tiết nắng nóng, khô hanh, thiếu gió và cây bị thiếu nước.',
    organic_treatment: [
      'Dùng vòi nước áp lực xịt mạnh vào mặt dưới lá để rửa trôi nhện đỏ và mạng tơ.',
      'Phun nước rửa chén hữu cơ pha loãng (3 giọt cho 1 lít nước) để làm ngạt côn trùng.',
      'Phun dung dịch gừng tỏi ớt ủ rượu định kỳ 3 ngày/lần.',
    ],
    prevention: [
      'Tạo ẩm xung quanh vườn vào những ngày hè khô nóng.',
      'Trồng xen các loài thảo mộc xua đuổi côn trùng như húng quế, sả, vạn thọ.',
    ],
    sample_img: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600&auto=format&fit=crop',
  },
];

export const DiseaseDiagnosisView: React.FC<DiseaseDiagnosisViewProps> = ({
  onAskChatbot,
}) => {
  const [activeDisease, setActiveDisease] = useState<PlantDisease>(COMMON_DISEASES[0]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [customFilePreview, setCustomFilePreview] = useState<string | null>(null);

  const handleSimulateDiagnosis = (file?: File) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      // Pick random disease for user upload simulation
      const random = COMMON_DISEASES[Math.floor(Math.random() * COMMON_DISEASES.length)];
      setActiveDisease(random);
      setIsAnalyzing(false);
    }, 800);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold">
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Bác Sĩ Cây Trồng AI &bull; Chẩn Đoán &amp; Kê Đơn Sinh Học</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Chẩn Đoán Bệnh Hoa &amp; Phác Đồ Trị Liệu
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Phát hiện sớm các triệu chứng phấn trắng, đốm đen, thối củ hay bọ trĩ trên các loài hoa. 
          Cung cấp phác đồ trị liệu 100% hữu cơ từ nguyên liệu nhà bếp an toàn cho gia đình và môi trường.
        </p>
      </div>

      {/* Disease Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COMMON_DISEASES.map((dis) => {
          const isSelected = activeDisease.id === dis.id;
          return (
            <button
              key={dis.id}
              onClick={() => setActiveDisease(dis)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                isSelected
                  ? 'bg-rose-50 border-rose-300 shadow-xs ring-2 ring-rose-400/20'
                  : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    dis.severity === 'high'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {dis.severity === 'high' ? 'Khẩn cấp' : 'Cần xử lý'}
                </span>
                <HeartPulse
                  className={`w-4 h-4 ${
                    isSelected ? 'text-rose-600' : 'text-stone-400'
                  }`}
                />
              </div>

              <div>
                <h4 className="font-bold text-sm text-stone-900">{dis.name_vi}</h4>
                <p className="text-[11px] italic text-stone-500 font-serif truncate">
                  {dis.scientific}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed Diagnosis Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Symptoms & Causes */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {activeDisease.name_vi}
                </h3>
                <p className="text-xs text-stone-500 italic font-serif">
                  Tác nhân: {activeDisease.scientific}
                </p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  activeDisease.severity === 'high'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Mức nguy hại: {activeDisease.severity === 'high' ? 'Cao' : 'Trung bình'}
              </span>
            </div>

            {/* Affected Species */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-stone-700">Các loài dễ nhiễm:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeDisease.affected_species.map((sp, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-xs"
                  >
                    {sp}
                  </span>
                ))}
              </div>
            </div>

            {/* Symptoms List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Dấu hiệu nhận biết đặc trưng:</span>
              </span>
              <ul className="space-y-1.5 text-xs text-stone-600">
                {activeDisease.symptoms.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">&bull;</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Root Cause */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 text-xs space-y-1">
              <span className="font-bold text-stone-800">Nguyên nhân môi trường:</span>
              <p className="text-stone-600 leading-relaxed">{activeDisease.cause}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Organic Treatment Prescription */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-md shadow-emerald-700/5 space-y-6">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <Pill className="w-5 h-5 text-emerald-600" />
              <h4 className="font-serif font-bold text-lg text-stone-900">
                Phác Đồ Trị Liệu Sinh Học (100% Tự Nhiên)
              </h4>
            </div>

            {/* Treatment steps */}
            <div className="space-y-3">
              {activeDisease.organic_treatment.map((treat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed">{treat}</p>
                </div>
              ))}
            </div>

            {/* Prevention tips */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Biện pháp phòng ngừa lâu dài:</span>
              </span>
              <ul className="space-y-1 text-xs text-stone-600">
                {activeDisease.prevention.map((prev, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">&bull;</span>
                    <span>{prev}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Consultation CTA */}
            <div className="pt-2">
              <button
                onClick={() =>
                  onAskChatbot(
                    `Cô làm vườn ơi, hoa của tôi đang bị ${activeDisease.name_vi} (${activeDisease.scientific}). Xin hướng dẫn thêm liều lượng và thời gian phun trị liệu?`
                  )
                }
                className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Bot className="w-4 h-4" />
                <span>Hỏi Cô làm vườn về ca bệnh này</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
