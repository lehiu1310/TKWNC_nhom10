const STORAGE_KEY = 'vuon-hoa-my-garden-v1';
export const CARE_TYPES = [
  { id: 'water', label: 'Kiểm tra / tưới nước', icon: '◌' },
  { id: 'feed', label: 'Bón phân', icon: '✳' },
  { id: 'prune', label: 'Tỉa cành, ngắt hoa tàn', icon: '✂' },
];

function validPlant(value) {
  return value && typeof value.speciesId === 'string' && value.speciesId && value.intervals && typeof value.intervals === 'object';
}

export function readGarden() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      plants: Array.isArray(parsed.plants) ? parsed.plants.filter(validPlant) : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders.filter((item) => typeof item?.id === 'string' && typeof item?.title === 'string' && /^\d{2}-\d{2}$/.test(item?.monthDay || '')) : [],
    };
  } catch {
    return { plants: [], reminders: [] };
  }
}

export function writeGarden(value) {
  const current = readGarden();
  const safe = {
    plants: Array.isArray(value?.plants) ? value.plants.filter(validPlant).slice(-100) : [],
    reminders: Array.isArray(value?.reminders) ? value.reminders.slice(-100) : current.reminders,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  window.dispatchEvent(new CustomEvent('garden:planner-updated'));
  return safe;
}

export function addGardenReminder(title, date, now = new Date()) {
  const cleanTitle = String(title || '').trim().slice(0, 80);
  const parsed = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!cleanTitle || !parsed) return readGarden();
  const month = Number(parsed[1]);
  const day = Number(parsed[2]);
  const check = new Date(2000, month - 1, day);
  if (check.getMonth() !== month - 1 || check.getDate() !== day) return readGarden();
  const garden = readGarden();
  const unique = globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  return writeGarden({ reminders: [...garden.reminders, { id: `event-${unique}`, title: cleanTitle, monthDay: `${parsed[1]}-${parsed[2]}`, annual: true, createdAt: now.toISOString() }] });
}

export function removeGardenReminder(reminderId) {
  return writeGarden({ reminders: readGarden().reminders.filter((reminder) => reminder.id !== reminderId) });
}

export function nextReminderDate(reminder, now = new Date()) {
  const match = /^(\d{2})-(\d{2})$/.exec(reminder?.monthDay || '');
  if (!match) return null;
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  for (let year = now.getFullYear(); year <= now.getFullYear() + 8; year += 1) {
    const candidate = new Date(year, month, day, 9, 0, 0, 0);
    if (candidate.getMonth() !== month || candidate.getDate() !== day || candidate < now) continue;
    return candidate;
  }
  return null;
}

export function listUpcomingReminders(garden, now = new Date(), daysAhead = 30) {
  return (garden?.reminders || []).flatMap((reminder) => {
    const dueAt = nextReminderDate(reminder, now);
    return dueAt && dueAt.getTime() <= now.getTime() + daysAhead * 86_400_000 ? [{ ...reminder, dueAt }] : [];
  }).sort((a, b) => a.dueAt - b.dueAt);
}

export function addGardenPlant(speciesId, now = new Date()) {
  const garden = readGarden();
  if (!speciesId || garden.plants.some((plant) => plant.speciesId === speciesId)) return garden;
  const timestamp = now.toISOString();
  return writeGarden({ plants: [...garden.plants, {
    id: `${speciesId}-${now.getTime()}`,
    speciesId,
    addedAt: timestamp,
    intervals: { water: 0, feed: 0, prune: 0 },
    lastDone: { water: timestamp, feed: timestamp, prune: timestamp },
  }] });
}

export function removeGardenPlant(plantId) {
  return writeGarden({ plants: readGarden().plants.filter((plant) => plant.id !== plantId) });
}

export function setCareInterval(plantId, careType, days, now = new Date()) {
  if (!CARE_TYPES.some((item) => item.id === careType)) return readGarden();
  const interval = Number(days);
  if (!Number.isInteger(interval) || interval < 0 || interval > 365) return readGarden();
  const garden = readGarden();
  return writeGarden({ plants: garden.plants.map((plant) => {
    if (plant.id !== plantId) return plant;
    const previous = Number(plant.intervals?.[careType]) || 0;
    const next = { ...plant, intervals: { ...plant.intervals, [careType]: interval } };
    return previous === interval ? next : { ...next, lastDone: { ...(plant.lastDone || {}), [careType]: now.toISOString() } };
  }) });
}

export function completeCare(plantId, careType, now = new Date()) {
  if (!CARE_TYPES.some((item) => item.id === careType)) return readGarden();
  const garden = readGarden();
  return writeGarden({ plants: garden.plants.map((plant) => plant.id === plantId
    ? { ...plant, lastDone: { ...(plant.lastDone || {}), [careType]: now.toISOString() } }
    : plant) });
}

export function nextCareDate(plant, careType) {
  const days = Number(plant?.intervals?.[careType]);
  const lastDone = Date.parse(plant?.lastDone?.[careType] || plant?.addedAt);
  if (!Number.isInteger(days) || days < 1 || !Number.isFinite(lastDone)) return null;
  return new Date(lastDone + days * 86_400_000);
}

export function listCareTasks(garden, now = new Date()) {
  return (garden?.plants || []).flatMap((plant) => CARE_TYPES.flatMap((care) => {
    const dueAt = nextCareDate(plant, care.id);
    return dueAt ? [{ plantId: plant.id, speciesId: plant.speciesId, careType: care.id, label: care.label, dueAt, overdue: dueAt.getTime() <= now.getTime() }] : [];
  })).sort((a, b) => a.dueAt - b.dueAt);
}

export function notificationKey(task) {
  return `${task.plantId}:${task.careType}:${task.dueAt.toISOString().slice(0, 10)}`;
}
