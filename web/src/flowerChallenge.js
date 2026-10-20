const STORAGE_KEY = 'vuon-hoa-daily-challenge-v1';

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function getDailyChallenge(flowers, date = new Date()) {
  const list = Array.isArray(flowers) ? flowers.filter((flower) => typeof flower?.id === 'string' && flower.id) : [];
  if (list.length < 4) return null;
  const key = localDateKey(date);
  const seed = hash(key);
  const target = list[seed % list.length];
  let random = seed || 1;
  const shuffle = (items) => {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      const swapIndex = (random >>> 0) % (index + 1);
      [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
    }
    return output;
  };
  const others = shuffle(list.filter((flower) => flower.id !== target.id)).slice(0, 3);
  const options = shuffle([target, ...others]);
  return { date: key, target, options };
}

export function readChallengeProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      completed: Number.isInteger(data.completed) && data.completed >= 0 ? data.completed : 0,
      correct: Number.isInteger(data.correct) && data.correct >= 0 ? data.correct : 0,
      streak: Number.isInteger(data.streak) && data.streak >= 0 ? data.streak : 0,
      lastPlayed: typeof data.lastPlayed === 'string' ? data.lastPlayed : '',
      lastAnswer: data.lastAnswer && typeof data.lastAnswer === 'object' ? data.lastAnswer : null,
    };
  } catch {
    return { completed: 0, correct: 0, streak: 0, lastPlayed: '', lastAnswer: null };
  }
}

export function recordDailyAttempt({ date, targetId, selectedId }) {
  const previous = readChallengeProgress();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !targetId || !selectedId) return previous;
  if (previous.lastPlayed === date) return previous;
  const playedDay = new Date(`${date}T12:00:00`);
  const yesterday = new Date(playedDay);
  yesterday.setDate(yesterday.getDate() - 1);
  const continued = previous.lastPlayed === localDateKey(yesterday);
  const correct = selectedId === targetId;
  const next = {
    completed: previous.completed + 1,
    correct: previous.correct + (correct ? 1 : 0),
    streak: continued ? previous.streak + 1 : 1,
    lastPlayed: date,
    lastAnswer: { date, targetId, selectedId, correct },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function challengeBadges(progress) {
  const badges = [];
  if (progress.completed >= 1) badges.push({ id: 'first', name: 'Nụ đầu mùa', icon: '✿' });
  if (progress.streak >= 3) badges.push({ id: 'three-days', name: 'Ba ngày chăm vườn', icon: '☀' });
  if (progress.streak >= 7) badges.push({ id: 'seven-days', name: 'Một tuần cùng hoa', icon: '✦' });
  if (progress.correct >= 10) badges.push({ id: 'ten-correct', name: 'Mắt hoa tinh tường', icon: '◎' });
  return badges;
}
