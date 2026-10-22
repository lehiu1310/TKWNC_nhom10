const STORAGE_KEY = 'vuon-hoa-giftbook-v1';

export function readGiftBook() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      recognitions: Array.isArray(value.recognitions) ? value.recognitions : [],
      favorites: Array.isArray(value.favorites) ? value.favorites : [],
      bouquets: Array.isArray(value.bouquets) ? value.bouquets : [],
    };
  } catch {
    return { recognitions: [], favorites: [], bouquets: [] };
  }
}

export function recentUniqueRecognitions(recognitions, limit = 8) {
  if (!Array.isArray(recognitions) || !Number.isFinite(limit) || limit < 1) return [];
  const seen = new Set();
  const recent = [];
  for (const entry of recognitions) {
    if (typeof entry?.speciesId !== 'string' || !entry.speciesId || seen.has(entry.speciesId)) continue;
    seen.add(entry.speciesId);
    recent.push(entry);
    if (recent.length >= Math.floor(limit)) break;
  }
  return recent;
}

export function writeGiftBook(next) {
  const value = {
    recognitions: Array.isArray(next.recognitions) ? next.recognitions.slice(-100) : [],
    favorites: Array.isArray(next.favorites) ? next.favorites.slice(-100) : [],
    bouquets: Array.isArray(next.bouquets) ? next.bouquets.slice(-100) : [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('garden:giftbook-updated'));
  return value;
}

export function rememberRecognition(species) {
  if (!species?.id) return;
  const book = readGiftBook();
  book.recognitions.unshift({ speciesId: species.id, at: new Date().toISOString() });
  writeGiftBook(book);
}

export function rememberFavorite(speciesId) {
  const book = readGiftBook();
  const next = book.favorites.includes(speciesId)
    ? book.favorites.filter((id) => id !== speciesId)
    : [...book.favorites, speciesId];
  return writeGiftBook({ ...book, favorites: next });
}

export function openGardenerWith(question) {
  sessionStorage.setItem('garden-chat-prefill', question);
  window.dispatchEvent(new CustomEvent('garden:open-chat'));
}
