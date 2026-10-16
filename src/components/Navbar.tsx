import React from 'react';
import {
  Flower2,
  Search,
  Crosshair,
  Image as ImageIcon,
  Bot,
  BookOpen,
  Activity,
  Sparkles,
  Box,
  Stethoscope,
  Trophy,
  GitCompare,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openHealthModal: () => void;
  healthOk: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openHealthModal,
  healthOk,
}) => {
  const navItems = [
    { id: 'home', label: 'Trang chủ', icon: Flower2 },
    { id: '3d-garden', label: 'Vườn 3D', icon: Box, badge: 'Three.js' },
    { id: 'classifier', label: 'Kính lúp', icon: Search, badge: 'ResNet' },
    { id: 'detector', label: 'Mắt thần', icon: Crosshair, badge: 'YOLO11' },
    { id: 'diagnosis', label: 'Bác sĩ hoa', icon: Stethoscope, badge: 'Mới' },
    { id: 'quiz', label: 'Đố vui hoa', icon: Trophy, badge: 'Game' },
    { id: 'retrieval', label: 'Album hoa', icon: ImageIcon, badge: 'FAISS' },
    { id: 'chatbot', label: 'Cô làm vườn', icon: Bot, badge: 'RAG' },
    { id: 'compare', label: 'So sánh', icon: GitCompare },
    { id: 'encyclopedia', label: 'Bách khoa', icon: BookOpen, badge: '103' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
              <Flower2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg sm:text-xl text-stone-900 tracking-tight">
                  Vườn Hoa AI
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  TKWNC Nhóm 10
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">
                Nhận diện thực vật học & Trợ lý thông minh
              </p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 shadow-2xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-700' : 'text-stone-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isActive
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* System Status Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={openHealthModal}
              title="Xem trạng thái hệ thống AI & mô hình"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-xs text-stone-700 cursor-pointer shadow-2xs"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    healthOk ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    healthOk ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <Activity className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline font-mono">
                {healthOk ? 'API Live' : 'Checking'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="md:hidden flex overflow-x-auto px-2 py-2 gap-1 border-t border-stone-100 scrollbar-none bg-stone-50/80">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 bg-white border border-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
