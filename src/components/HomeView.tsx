import React from 'react';
import {
  Search,
  Crosshair,
  Image as ImageIcon,
  Bot,
  BookOpen,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight,
  Box,
  Stethoscope,
  Trophy,
  GitCompare,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface HomeViewProps {
  setActiveTab: (tab: string) => void;
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
  onQuickClassify: (speciesId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  setActiveTab,
  speciesList,
  onSelectSpecies,
  onQuickClassify,
}) => {
  const highlights = speciesList.filter((s) => s.category === 'highlight');

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-stone-900 via-emerald-950 to-stone-900 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-5xl mx-auto px-6 py-12 sm:py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nghiên cứu & Ứng dụng AI Nhận Diện Thực Vật Học</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-stone-50 leading-tight">
            Khám Phá &amp; Nhận Diện <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200">
              103 Loài Hoa
            </span>{' '}
            Cùng Trí Tuệ Nhân Tạo
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-stone-300 font-light leading-relaxed">
            Hệ sinh thái bốn chức năng AI hiện đại: Kính lúp phân loại (ResNet-18 + Grad-CAM),
            Mắt thần phát hiện đối tượng (YOLO11), Album tìm kiếm đa phương thức (CLIP + FAISS)
            và Trợ lý làm vườn tiếng Việt (Gemini RAG).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setActiveTab('3d-garden')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-700/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-102"
            >
              <Box className="w-4 h-4" />
              <span>Bước Vào Vườn Hoa 3D</span>
            </button>
            <button
              onClick={() => setActiveTab('classifier')}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-stone-100 border border-white/20 font-medium text-sm backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 text-emerald-300" />
              <span>Thử Kính Lúp Hoa</span>
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className="px-6 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-medium text-sm backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Đố Vui Hoa</span>
            </button>
            <button
              onClick={() => setActiveTab('encyclopedia')}
              className="px-5 py-3 rounded-xl bg-transparent hover:bg-white/5 text-stone-300 font-medium text-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Xem 103 Loài</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight Stats Bar */}
        <div className="border-t border-white/10 bg-black/20 backdrop-blur-xs px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-serif font-bold text-emerald-400">103 Loài</div>
            <div className="text-xs text-stone-400">Bộ nhãn Oxford + TF</div>
          </div>
          <div>
            <div className="text-2xl font-serif font-bold text-amber-300">90.26%</div>
            <div className="text-xs text-stone-400">Độ chính xác phân loại (F1 91.56%)</div>
          </div>
          <div>
            <div className="text-2xl font-serif font-bold text-teal-300">1,236 Ảnh</div>
            <div className="text-xs text-stone-400">Chỉ mục FAISS tìm kiếm</div>
          </div>
          <div>
            <div className="text-2xl font-serif font-bold text-purple-300">RAG Tiếng Việt</div>
            <div className="text-xs text-stone-400">Truy xuất BM25 + Gemini</div>
          </div>
        </div>
      </section>

      {/* 4 Core AI Tasks Grid */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Công nghệ lõi
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Bốn Ứng Dụng AI Thực Vật Học
            </h2>
          </div>
          <p className="text-sm text-stone-500 max-w-md">
            Mỗi công cụ được tinh chỉnh từ các mô hình thị giác và ngôn ngữ chuyên sâu cho thực vật học.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Classifier */}
          <div
            onClick={() => setActiveTab('classifier')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-emerald-300 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-emerald-700 transition-colors">
                    Kính Lúp Hoa
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    ResNet-18
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Tải ảnh hoa lên để nhận diện tự động trong 103 loài với xác suất Top-K và bản đồ nhiệt Grad-CAM giải thích vùng chú ý của mạng nơ-ron.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-emerald-700 group-hover:translate-x-1 transition-transform">
              <span>Bắt đầu nhận diện</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 2: Detector */}
          <div
            onClick={() => setActiveTab('detector')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-amber-300 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Crosshair className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-amber-700 transition-colors">
                    Mắt Thần Vườn
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    YOLO11
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Phát hiện hộp đối tượng (Bounding Boxes) cho hoa hồng, cúc, hướng dương, bồ công anh. Hỗ trợ quét qua webcam thời gian thực với bộ đo FPS.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-amber-700 group-hover:translate-x-1 transition-transform">
              <span>Mở quét ảnh / webcam</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 3: Retrieval */}
          <div
            onClick={() => setActiveTab('retrieval')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-teal-300 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-teal-700 transition-colors">
                    Album Hoa
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">
                    CLIP + FAISS
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Truy tìm hình ảnh tương đồng bằng văn bản mô tả (tiếng Việt hoặc tiếng Anh) hoặc bằng ảnh mẫu trong cơ sở dữ liệu 1.236 ảnh hoa chuẩn hóa.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-teal-700 group-hover:translate-x-1 transition-transform">
              <span>Khám phá album</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 4: Chatbot RAG */}
          <div
            onClick={() => setActiveTab('chatbot')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-purple-300 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-purple-700 transition-colors">
                    Cô Làm Vườn
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                    Gemini RAG
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Trợ lý hỏi đáp cách chăm sóc, tưới nước, bón phân, mùa hoa và ý nghĩa phong thủy với trích dẫn tài liệu cụ thể [cham_soc_hoa.md].
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-purple-700 group-hover:translate-x-1 transition-transform">
              <span>Trò chuyện ngay</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 5: 3D Garden */}
          <div
            onClick={() => setActiveTab('3d-garden')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-emerald-400 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Box className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-emerald-700 transition-colors">
                    Vườn Hoa 3D
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Three.js
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Nhà kính sinh thái 3D tương tác đa góc nhìn. Chạm vào từng đóa hoa để kích hoạt chuyển động, thay đổi thời gian (bình minh, hoàng hôn, đêm sao).
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-emerald-700 group-hover:translate-x-1 transition-transform">
              <span>Bước vào nhà kính 3D</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 6: Disease Diagnosis */}
          <div
            onClick={() => setActiveTab('diagnosis')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-rose-400 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-rose-700 transition-colors">
                    Bác Sĩ Cây Trồng
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-semibold">
                    Bệnh cây
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Chẩn đoán các chứng bệnh phổ biến (phấn trắng, đốm đen, thối củ úng rễ, bọ trĩ) và đơn thuốc xử lý sinh học tự nhiên 100% an toàn.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-rose-700 group-hover:translate-x-1 transition-transform">
              <span>Chẩn đoán &amp; Kê đơn</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 7: Quiz Game */}
          <div
            onClick={() => setActiveTab('quiz')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-amber-400 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-amber-700 transition-colors">
                    Thợ Săn Hoa
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    Mini-Game
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Thử thách 10 câu hỏi nhận diện hình ảnh hoa thật trong bộ Oxford Flowers 102. Tích lũy chuỗi combo để nhân đôi điểm thưởng.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-amber-700 group-hover:translate-x-1 transition-transform">
              <span>Chơi thử thách ngay</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>

          {/* Card 8: Compare */}
          <div
            onClick={() => setActiveTab('compare')}
            className="group relative bg-white rounded-2xl p-6 border border-stone-200 hover:border-blue-400 shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GitCompare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-stone-900 group-hover:text-blue-700 transition-colors">
                    So Sánh Loài Hoa
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                    Đối chiếu
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Đặt 2-3 loài hoa cạnh nhau để đối chiếu trực quan về ánh sáng, lịch tưới, thổ nhưỡng, mùa hoa và độ khó chăm sóc.
                </p>
              </div>
            </div>
            <div className="pt-4 flex items-center text-xs font-semibold text-blue-700 group-hover:translate-x-1 transition-transform">
              <span>So sánh đối chiếu</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* 5 Highlight Species Showcase */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Nhóm hoa tiêu biểu
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Năm Loài Hoa Nổi Bật
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('encyclopedia')}
            className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Tất cả 103 loài</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {highlights.map((sp) => {
            return (
              <div
                key={sp.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-4/3 overflow-hidden bg-stone-100">
                    <img
                      src={`/${sp.image}`}
                      alt={sp.name_vi}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
                      }}
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white">
                      {sp.id}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div>
                      <h4 className="font-bold text-stone-900 group-hover:text-emerald-700 transition-colors">
                        {sp.name_vi}
                      </h4>
                      <p className="text-xs italic text-stone-500 font-serif">
                        {sp.scientific_name}
                      </p>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2">
                      {sp.meaning}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onQuickClassify(sp.id)}
                      title="Thử phân loại loài hoa này ngay lập tức"
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium transition-colors text-center cursor-pointer"
                    >
                      Nhận diện
                    </button>
                    <button
                      onClick={() => onSelectSpecies(sp)}
                      title="Xem thông tin chi tiết thực vật học"
                      className="py-1.5 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Architecture & Methodology Note */}
      <section className="bg-stone-100 rounded-3xl p-6 sm:p-8 border border-stone-200/80 space-y-4">
        <div className="flex items-center gap-2 text-stone-800 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Kiểm Chứng Huấn Luyện &amp; Báo Cáo Kỹ Thuật (Rubric 10.2)</span>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Bộ phân loại sử dụng mạng nơ-ron tích chập <strong>ResNet-18</strong> fine-tune trên{' '}
          <strong>11.859 ảnh với 103 nhãn</strong> (Oxford Flowers 102 + TF Flowers), đạt Accuracy{' '}
          <strong>90.26%</strong>, Macro-F1 <strong>91.56%</strong>. Mô hình phát hiện đối tượng fine-tune{' '}
          <strong>YOLO11n</strong> trên bộ dữ liệu Weirdo-329 (Apache-2.0) đạt mAP50 = 0.7306.
          Hệ thống tìm kiếm ảnh sử dụng <strong>MobileCLIP2-S0 + FAISS</strong> với 1.236 vector ảnh.
          Chatbot RAG sử dụng <strong>Gemini 3.8 Flash</strong> kết hợp truy xuất từ vựng BM25 đa tầng trên các cẩm nang thực vật học tiếng Việt.
        </p>
      </section>
    </div>
  );
};
