import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Zap,
  Award,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface QuizGameViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
}

interface Question {
  image: string;
  correctSpecies: FlowerSpecies;
  options: FlowerSpecies[];
}

export const QuizGameView: React.FC<QuizGameViewProps> = ({
  speciesList,
  onSelectSpecies,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Web Audio chime generator
  const playSound = (isCorrect: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCorrect) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220.0, ctx.currentTime);
        osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio might be blocked before first user gesture
    }
  };

  // Generate 10 randomized quiz questions
  const generateQuiz = () => {
    if (speciesList.length < 4) return;
    const shuffled = [...speciesList].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    const generated: Question[] = selected.map((correct) => {
      const wrong = speciesList
        .filter((s) => s.id !== correct.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const allOptions = [correct, ...wrong].sort(() => 0.5 - Math.random());
      return {
        image: correct.image,
        correctSpecies: correct,
        options: allOptions,
      };
    });

    setQuestions(generated);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setIsGameOver(false);
  };

  useEffect(() => {
    generateQuiz();
  }, [speciesList]);

  const handleSelectAnswer = (optionId: string) => {
    if (isAnswered) return;
    const currentQ = questions[currentIdx];
    const isCorrect = optionId === currentQ.correctSpecies.id;

    setSelectedOption(optionId);
    setIsAnswered(true);

    if (isCorrect) {
      const bonus = 100 + streak * 25;
      setScore((prev) => prev + bonus);
      setStreak((prev) => prev + 1);
      playSound(true);

      if (streak + 1 >= 3) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    } else {
      setStreak(0);
      playSound(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsGameOver(true);
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.6 },
      });
    }
  };

  const currentQ = questions[currentIdx];

  return (
    <div className="space-y-8 pb-16 max-w-3xl mx-auto">
      {/* Title Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
          <Trophy className="w-3.5 h-3.5" />
          <span>Mini-Game &bull; Thử Thách Nhận Diện 103 Loài Hoa</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Thợ Săn Hoa Tinh Anh
        </h1>
        <p className="text-sm text-stone-600 max-w-lg mx-auto">
          Nhìn ảnh hoa thật từ bộ dữ liệu Oxford Flowers 102 và chọn đúng tên loài hoa. Duy trì chuỗi đúng liên tiếp để nhân điểm thưởng!
        </p>
      </div>

      {!isGameOver && currentQ ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-md space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4 text-xs font-semibold">
            <span className="text-stone-500 font-mono">
              Câu hỏi: <strong>{currentIdx + 1}</strong> / {questions.length}
            </span>

            <div className="flex items-center gap-4">
              {streak > 1 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold animate-bounce">
                  <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Chuỗi x{streak}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100 text-stone-800 font-mono font-bold">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>{score} điểm</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Flower Image */}
          <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center">
            <img
              src={`/${currentQ.image}`}
              alt="Quiz Flower"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
              }}
            />
          </div>

          {/* Multiple Choice Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const isCorrectAnswer = opt.id === currentQ.correctSpecies.id;

              let btnStyle = 'bg-stone-50 border-stone-200 hover:border-stone-300 text-stone-800';
              if (isAnswered) {
                if (isCorrectAnswer) {
                  btnStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-300';
                } else if (isSelected) {
                  btnStyle = 'bg-red-50 border-red-300 text-red-900';
                } else {
                  btnStyle = 'opacity-40 bg-stone-50 border-stone-200';
                }
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectAnswer(opt.id)}
                  disabled={isAnswered}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
                >
                  <div>
                    <h4 className="font-bold text-sm">{opt.name_vi}</h4>
                    <p className="text-xs text-stone-500 italic font-serif">
                      {opt.scientific_name}
                    </p>
                  </div>

                  {isAnswered && isCorrectAnswer && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrectAnswer && (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Answer Explanation & Next CTA */}
          {isAnswered && (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-xs">
                    Loài hoa chính xác: <strong>{currentQ.correctSpecies.name_vi}</strong>
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Ý nghĩa: {currentQ.correctSpecies.meaning}
                  </p>
                </div>

                <button
                  onClick={handleNextQuestion}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <span>{currentIdx + 1 === questions.length ? 'Xem kết quả' : 'Câu kế tiếp'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Game Over Screen */
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stone-200 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-md">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Hoàn Thành Thử Thách
            </span>
            <h2 className="text-3xl font-serif font-bold text-stone-900">
              {score >= 800
                ? 'Bậc Thầy Thực Vật Học!'
                : score >= 500
                ? 'Nhà Thực Vật Học Tiềm Năng!'
                : 'Học Viên Vườn Hoa'}
            </h2>
            <p className="text-sm text-stone-600 max-w-sm mx-auto">
              Bạn đã đạt tổng cộng <strong>{score}</strong> điểm trong 10 câu hỏi thử thách nhận diện hoa.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={generateQuiz}
              className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại vòng mới</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
