import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { ClassifierView } from './components/ClassifierView';
import { DetectorView } from './components/DetectorView';
import { RetrievalView } from './components/RetrievalView';
import { ChatbotView } from './components/ChatbotView';
import { EncyclopediaView } from './components/EncyclopediaView';
import { Garden3DView } from './components/Garden3DView';
import { DiseaseDiagnosisView } from './components/DiseaseDiagnosisView';
import { QuizGameView } from './components/QuizGameView';
import { CompareView } from './components/CompareView';
import { SpeciesDetailModal } from './components/SpeciesDetailModal';
import { HealthModal } from './components/HealthModal';
import { FlowerSpecies, SystemHealth } from './types';
import localSpeciesData from './data/species.json';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [speciesList, setSpeciesList] = useState<FlowerSpecies[]>(localSpeciesData as FlowerSpecies[]);
  const [selectedSpecies, setSelectedSpecies] = useState<FlowerSpecies | null>(null);
  const [classifierPresetId, setClassifierPresetId] = useState<string | null>(null);
  const [botInitialQuestion, setBotInitialQuestion] = useState<string | null>(null);
  const [isHealthOpen, setIsHealthOpen] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Fetch species catalog from backend
  const fetchSpecies = async () => {
    try {
      const res = await fetch('/api/species?limit=103');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSpeciesList(data);
        }
      }
    } catch (err) {
      console.warn('Using local bundled species data:', err);
    }
  };

  // Fetch health check
  const fetchHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (err) {
      console.warn('Health check error:', err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    fetchSpecies();
    fetchHealth();
  }, []);

  const handleQuickClassify = (speciesId: string) => {
    setClassifierPresetId(speciesId);
    setActiveTab('classifier');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAskChatbot = (question: string) => {
    setBotInitialQuestion(question);
    setActiveTab('chatbot');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchGallery = (speciesId: string) => {
    setActiveTab('retrieval');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 selection:bg-emerald-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        openHealthModal={() => setIsHealthOpen(true)}
        healthOk={systemHealth?.status === 'ok'}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'home' && (
          <HomeView
            setActiveTab={setActiveTab}
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
            onQuickClassify={handleQuickClassify}
          />
        )}

        {activeTab === 'classifier' && (
          <ClassifierView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
            onAskChatbot={handleAskChatbot}
            initialSpeciesId={classifierPresetId}
          />
        )}

        {activeTab === '3d-garden' && (
          <Garden3DView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
            onAskChatbot={handleAskChatbot}
          />
        )}

        {activeTab === 'detector' && <DetectorView />}

        {activeTab === 'diagnosis' && (
          <DiseaseDiagnosisView onAskChatbot={handleAskChatbot} />
        )}

        {activeTab === 'quiz' && (
          <QuizGameView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
          />
        )}

        {activeTab === 'retrieval' && (
          <RetrievalView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
          />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotView initialQuestion={botInitialQuestion} />
        )}

        {activeTab === 'compare' && (
          <CompareView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
          />
        )}

        {activeTab === 'encyclopedia' && (
          <EncyclopediaView
            speciesList={speciesList}
            onSelectSpecies={setSelectedSpecies}
            onQuickClassify={handleQuickClassify}
            onAskChatbot={handleAskChatbot}
          />
        )}
      </main>

      {/* Botanical Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white py-8 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="font-bold text-stone-800">
              TKWNC_nhom10 — Nền tảng Trí tuệ Nhân tạo Vườn hoa (Vườn Hoa AI)
            </p>
            <p>
              Xây dựng với ResNet-18, YOLO11n, MobileCLIP2-S0, FAISS và Gemini RAG.
            </p>
          </div>
          <div className="flex items-center gap-4 text-stone-600">
            <button
              onClick={() => setIsHealthOpen(true)}
              className="hover:text-emerald-700 underline cursor-pointer"
            >
              Chẩn đoán hệ thống
            </button>
            <span>&bull;</span>
            <button
              onClick={() => {
                setActiveTab('encyclopedia');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-emerald-700 underline cursor-pointer"
            >
              103 Loài hoa
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SpeciesDetailModal
        species={selectedSpecies}
        onClose={() => setSelectedSpecies(null)}
        onClassify={handleQuickClassify}
        onSearchGallery={handleSearchGallery}
        onAskBot={handleAskChatbot}
      />

      <HealthModal
        health={systemHealth}
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        onRefresh={fetchHealth}
        isChecking={isCheckingHealth}
      />
    </div>
  );
};

export default App;
