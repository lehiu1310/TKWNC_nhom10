import React from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import { SystemHealth } from '../types';

interface HealthModalProps {
  health: SystemHealth | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isChecking: boolean;
}

export const HealthModal: React.FC<HealthModalProps> = ({
  health,
  isOpen,
  onClose,
  onRefresh,
  isChecking,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-6 p-6 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-stone-900">Trạng Thái Hệ Thống AI</h3>
              <p className="text-[11px] text-stone-500 font-mono">
                API Endpoint: <code>/api/health</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">Trạng thái máy chủ:</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{health?.status === 'ok' ? 'Đang hoạt động (OK)' : 'Đang kiểm tra'}</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-stone-500 text-[11px]">Thiết bị tính toán:</span>
              <p className="font-mono font-bold text-stone-800 uppercase">
                {health?.device || 'CPU'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 text-[11px]">Bản phát hành Git:</span>
              <p className="font-mono font-bold text-stone-800">
                {health?.revision || 'c8f7ac4'}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Models Status Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Trạng thái 4 mô hình AI
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { id: 'classifier', name: 'ResNet-18', label: 'Phân loại 103 loài' },
              { id: 'detector', name: 'YOLO11n', label: 'Phát hiện 4 lớp hoa' },
              { id: 'retrieval', name: 'MobileCLIP2', label: 'Chỉ mục FAISS 1.236' },
              { id: 'llm', name: 'Gemini RAG', label: 'Trợ lý tiếng Việt' },
            ].map((m) => {
              const state = health?.model_states?.[m.id as keyof typeof health.model_states] || 'ready';
              return (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{m.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[10px] text-stone-500">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dataset Counter */}
        {health?.dataset_info && (
          <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px] text-purple-950 flex items-center justify-between">
            <span>Dữ liệu hoa: {health.dataset_info.species_count} loài</span>
            <span>Kho ảnh: {health.dataset_info.gallery_images} ảnh</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onRefresh}
            disabled={isChecking}
            className="flex-1 py-2 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Làm mới chẩn đoán</span>
          </button>
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
