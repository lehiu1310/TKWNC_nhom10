function list(value, key) {
  return Array.isArray(value?.[key]) ? value[key] : [];
}

function identity(value, index, collection) {
  if (collection === 'garden') return value?.id || value?.speciesId || `item-${index}`;
  if (collection === 'favorites') return String(value);
  if (collection === 'recognitions') return `${value?.speciesId || ''}:${value?.at || ''}`;
  return value?.id || `${value?.createdAt || ''}:${value?.speciesId || ''}:${index}`;
}

/** Merge local-first browser data with the account copy, keeping the newest copy of duplicate entries. */
export function mergeAccountCollection(key, localValue, remoteValue) {
  if (key === 'garden') {
    const merged = new Map();
    for (const [index, plant] of [...list(remoteValue, 'plants'), ...list(localValue, 'plants')].entries()) {
      if (!plant || typeof plant !== 'object' || typeof plant.speciesId !== 'string' || !plant.intervals || typeof plant.intervals !== 'object' || Array.isArray(plant.intervals)) continue;
      merged.set(identity(plant, index, key), plant);
    }
    return { plants: [...merged.values()].slice(-100) };
  }

  if (key === 'giftbook') {
    const result = {};
    for (const field of ['recognitions', 'favorites', 'bouquets']) {
      const merged = new Map();
      for (const [index, entry] of [...list(remoteValue, field), ...list(localValue, field)].entries()) {
        if (field === 'favorites' && typeof entry !== 'string') continue;
        if (field !== 'favorites' && (!entry || typeof entry !== 'object' || Array.isArray(entry))) continue;
        merged.set(identity(entry, index, field), entry);
      }
      result[field] = [...merged.values()].slice(-100);
    }
    return result;
  }

  throw new TypeError(`Unknown account collection: ${key}`);
}
