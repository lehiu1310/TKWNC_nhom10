import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Sparkles,
  Sun,
  Droplets,
  Calendar,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface EncyclopediaViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
  onQuickClassify: (speciesId: string) => void;
  onAskChatbot: (question: string) => void;
}

export const EncyclopediaView: React.FC<EncyclopediaViewProps> = ({
  speciesList,
  onSelectSpecies,
  onQuickClassify,
  onAskChatbot,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedFamily, setSelectedFamily] = useState<string>('');

  // Extract unique families
  const families = useMemo(() => {
    const set = new Set<string>();
    speciesList.forEach((s) => {
      if (s.family) set.add(s.family);
    });
    return Array.from(set).sort();
  }, [speciesList]);

  // Filter species
  const filteredSpecies = useMemo(() => {
    return speciesList.filter((sp) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sp.name_vi?.toLowerCase().includes(q) ||
        sp.name_en?.toLowerCase().includes(q) ||
        sp.id.toLowerCase().includes(q) ||
        sp.scientific_name?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFamily && sp.family !== selectedFamily) return false;

      if (activeFilter === 'highlight') return sp.category === 'highlight';
      if (activeFilter === 'sun')
        return sp.sunlight?.toLowerCase().includes('nắng') || sp.sunlight?.toLowerCase().includes('toàn phần');
      if (activeFilter === 'cold')
        return (
          sp.sunlight?.toLowerCase().includes('mát') ||
          sp.care_guide?.toLowerCase().includes('lạnh') ||
          sp.meaning?.toLowerCase().includes('lạnh') ||
          sp.blooming_season?.toLowerCase().includes('đông')
        );

      return true;
    });
  }, [speciesList, searchTerm, activeFilter, selectedFamily]);

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Bách Khoa Toàn Thư &bull; 103 Loài Thực Vật Học</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Bách Khoa 103 Loài Hoa
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Tra cứu toàn diện 103 loài hoa trong bộ dữ liệu huấn luyện (Oxford Flowers 102 + TF Flowers). 
          Bao gồm tên khoa học, họ thực vật, cẩm nang tưới nước, nhu cầu ánh sáng, mùa hoa nở và ý nghĩa biểu tượng.
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên tiếng Việt, tiếng Anh, mã ID hoặc tên khoa học..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs sm:text-sm text-stone-900"
            />
          </div>

          {/* Family Dropdown */}
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-medium cursor-pointer"
          >
            <option value="">Tất cả họ thực vật ({families.length})</option>
            {families.map((fam, idx) => (
              <option key={idx} value={fam}>
                {fam}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Tất cả (103)' },
              { id: 'highlight', label: '5 Loài tiêu biểu' },
              { id: 'sun', label: 'Ưa nắng toàn phần' },
              { id: 'cold', label: 'Khí hậu mát mẻ / Mùa đông' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-stone-500 font-mono">
            Hiển thị <strong>{filteredSpecies.length}</strong> / {speciesList.length} loài
          </div>
        </div>
      </div>

      {/* Species Grid */}
      {filteredSpecies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredSpecies.map((sp) => (
            <div
              key={sp.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-lg transition-all group flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() => onSelectSpecies(sp)}
                  className="relative aspect-4/3 overflow-hidden bg-stone-100 cursor-pointer"
                >
                  <img
                    src={`/${sp.image}`}
                    alt={sp.name_vi}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white">
                    {sp.id}
                  </div>
                  {sp.category === 'highlight' && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                      Tiêu biểu
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <div onClick={() => onSelectSpecies(sp)} className="cursor-pointer">
                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-emerald-700 transition-colors">
                      {sp.name_vi}
                    </h3>
                    <p className="text-xs italic text-stone-500 font-serif">
                      {sp.scientific_name}
                    </p>
                  </div>

                  <p className="text-xs text-stone-600 line-clamp-2">
                    {sp.description}
                  </p>

                  <div className="pt-1 flex flex-wrap gap-1">
                    {sp.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 border-t border-stone-100 flex items-center justify-between gap-2 mt-2">
                <button
                  onClick={() => onSelectSpecies(sp)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-medium transition-colors cursor-pointer text-center"
                >
                  Chi tiết
                </button>
                <button
                  onClick={() => onQuickClassify(sp.id)}
                  title="Thử phân loại ảnh của loài hoa này"
                  className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Nhận diện
                </button>
                <button
                  onClick={() =>
                    onAskChatbot(`Cách trồng và chăm sóc loài hoa ${sp.name_vi}?`)
                  }
                  title="Hỏi Cô làm vườn về loài này"
                  className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-stone-300 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-bold text-stone-700 text-sm">
            Không tìm thấy loài hoa phù hợp
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Thử kiểm tra lại chính tả hoặc chọn "Tất cả (103)" để xem danh mục đầy đủ.
          </p>
        </div>
      )}
    </div>
  );
};
