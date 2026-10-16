import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Search,
  Filter,
  Upload,
  Sparkles,
  Zap,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { FlowerSpecies, GalleryItem } from '../types';

interface RetrievalViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
}

export const RetrievalView: React.FC<RetrievalViewProps> = ({
  speciesList,
  onSelectSpecies,
}) => {
  const [searchMode, setSearchMode] = useState<'text' | 'image'>('text');
  const [query, setQuery] = useState<string>('hoa hồng đỏ rực rỡ');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [k, setK] = useState<number>(8);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<GalleryItem[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<GalleryItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleQueries = [
    'hoa hồng đỏ rực rỡ',
    'hoa hướng dương vàng vươn cao',
    'cúc họa mi trắng mộc mạc',
    'hoa tulip kiêu sa trong nắng',
    'hoa sen thơm ngát đầm hồ',
    'hoa bồ công anh bay trong gió',
  ];

  const handleSearchText = async (textToSearch?: string) => {
    const q = textToSearch !== undefined ? textToSearch : query;
    if (!q.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/search/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          k,
          label: selectedLabel || undefined,
        }),
      });

      if (!res.ok) throw new Error('Tìm kiếm văn bản thất bại');
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchImage = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      formData.append('k', k.toString());
      if (selectedLabel) {
        formData.append('label', selectedLabel);
      }

      const res = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Tìm kiếm ảnh thất bại');
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Run initial search
  useEffect(() => {
    handleSearchText('hoa hồng');
  }, []);

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Ứng Dụng 3 &bull; MobileCLIP2-S0 + FAISS Index (1.236 Ảnh)</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Album Hoa — Truy Vấn Đa Phương Thức
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Tìm kiếm ảnh trong kho lưu trữ 1.236 ảnh thực vật học bằng câu mô tả tiếng Việt (dịch thuật ngữ nghĩa sang không gian vector CLIP) 
          hoặc bằng một bức ảnh mẫu để tìm các góc chụp, cấu trúc hoa tương đồng nhất.
        </p>
      </div>

      {/* Search Bar & Controls */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setSearchMode('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'text'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-teal-600" />
              <span>Tìm bằng mô tả</span>
            </button>
            <button
              onClick={() => setSearchMode('image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'image'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Tìm bằng ảnh mẫu</span>
            </button>
          </div>

          {/* Filter by Species & Result limit */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-medium cursor-pointer focus:outline-emerald-500"
              >
                <option value="">Tất cả 103 loài hoa</option>
                {speciesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_vi} ({s.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">Số lượng (k):</span>
              <select
                value={k}
                onChange={(e) => setK(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-medium cursor-pointer"
              >
                <option value="4">4 ảnh</option>
                <option value="8">8 ảnh</option>
                <option value="12">12 ảnh</option>
                <option value="16">16 ảnh</option>
                <option value="24">24 ảnh</option>
              </select>
            </div>
          </div>
        </div>

        {/* Text Mode Search Input */}
        {searchMode === 'text' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchText()}
                  placeholder="Nhập mô tả hoa (vd: hoa hồng đỏ rực, cánh hoa cúc họa mi trắng muốt...)"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-sm text-stone-900"
                />
              </div>
              <button
                onClick={() => handleSearchText()}
                disabled={isLoading}
                className="px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Zap className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Truy vấn</span>
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-stone-400 font-medium">Gợi ý nhanh:</span>
              {sampleQueries.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(sq);
                    handleSearchText(sq);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-teal-50 hover:text-teal-900 text-stone-600 text-xs transition-colors cursor-pointer"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image Mode Search Input */}
        {searchMode === 'image' && (
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFileChange}
              accept="image/*"
              className="hidden"
            />
            {imagePreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Search Seed"
                  className="w-16 h-16 rounded-xl object-cover border border-teal-200"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-teal-700 hover:underline cursor-pointer"
                >
                  Đổi ảnh khác
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-5 rounded-2xl border border-dashed border-stone-300 hover:border-teal-500 hover:bg-teal-50/50 text-xs font-semibold text-stone-700 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Chọn ảnh mẫu từ thiết bị</span>
              </button>
            )}

            <button
              onClick={handleSearchImage}
              disabled={isLoading}
              className="px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isLoading ? (
                <Zap className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Tìm ảnh tương đồng</span>
            </button>
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            Kết quả truy xuất FAISS: <strong>{results.length}</strong> ảnh
          </span>
          <span className="font-mono">Đo độ tương đồng Cosine qua MobileCLIP2</span>
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {results.map((item) => {
              const matchedSpecies = speciesList.find((s) => s.id === item.species_id);
              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewModalItem(item)}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-lg transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square overflow-hidden bg-stone-100">
                    <img
                      src={`/${item.path}`}
                      alt={item.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
                      }}
                    />
                    {item.score !== undefined && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-mono font-bold text-teal-300">
                        {(item.score * 100).toFixed(1)}% match
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="font-bold text-xs text-stone-900 group-hover:text-teal-700 transition-colors truncate">
                      {item.label}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="font-mono truncate">{item.species_id}</span>
                      <span className="text-[10px] text-stone-400 shrink-0">#{item.id}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 border border-dashed border-stone-300 text-center space-y-3">
            <ImageIcon className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-bold text-stone-700 text-sm">Không tìm thấy ảnh phù hợp</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Thử từ khóa khác hoặc bỏ chọn bộ lọc loài hoa để mở rộng phạm vi tìm kiếm.
            </p>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewModalItem && (
        <div
          onClick={() => setPreviewModalItem(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl space-y-4 p-6"
          >
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-stone-900">
              <img
                src={`/${previewModalItem.path}`}
                alt={previewModalItem.label}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-stone-900">
                    {previewModalItem.label}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono">
                    ID: {previewModalItem.species_id} &bull; Tệp #{previewModalItem.id}
                  </p>
                </div>
                {previewModalItem.score && (
                  <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 font-mono text-xs font-bold">
                    {(previewModalItem.score * 100).toFixed(1)}% tương đồng
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    const sp = speciesList.find((s) => s.id === previewModalItem.species_id);
                    if (sp) onSelectSpecies(sp);
                    setPreviewModalItem(null);
                  }}
                  className="flex-1 py-2 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold cursor-pointer text-center"
                >
                  Xem bách khoa loài này
                </button>
                <button
                  onClick={() => setPreviewModalItem(null)}
                  className="py-2 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
