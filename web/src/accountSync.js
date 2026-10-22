import { getAccount, getAccountData, putAccountData } from './api.js';
import { mergeAccountCollection } from './accountData.js';

const OWNER_STORAGE_KEY = 'vuon-hoa-account-owner-v1';
const accountJobs = new Map();

export const ACCOUNT_COLLECTIONS = [
  { key: 'garden', storage: 'vuon-hoa-my-garden-v1', empty: { plants: [] }, event: 'garden:planner-updated' },
  { key: 'giftbook', storage: 'vuon-hoa-giftbook-v1', empty: { recognitions: [], favorites: [], bouquets: [] }, event: 'garden:giftbook-updated' },
];

function readLocal(collection) {
  try {
    const value = JSON.parse(localStorage.getItem(collection.storage) || 'null');
    return value && typeof value === 'object' ? value : collection.empty;
  } catch {
    return collection.empty;
  }
}

function writeLocal(collection, value) {
  localStorage.setItem(collection.storage, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(collection.event));
}

export async function syncAccountCollections() {
  const { user } = await getAccount();
  if (!user) throw new Error('Hãy đăng nhập để đồng bộ dữ liệu.');
  const owner = localStorage.getItem(OWNER_STORAGE_KEY)?.toLowerCase();
  if (owner !== user.email.toLowerCase()) {
    await hydrateAccount(user);
    return;
  }
  for (const collection of ACCOUNT_COLLECTIONS) {
    await putAccountData(collection.key, readLocal(collection));
  }
}

function hydrateAccount(user) {
  const email = user?.email?.toLowerCase();
  if (!email) return Promise.resolve();
  if (accountJobs.has(email)) return accountJobs.get(email);
  const job = (async () => {
    const owner = localStorage.getItem(OWNER_STORAGE_KEY)?.toLowerCase();
    if (owner && owner !== email) {
      for (const collection of ACCOUNT_COLLECTIONS) writeLocal(collection, collection.empty);
    }
    for (const collection of ACCOUNT_COLLECTIONS) {
      const [local, remote] = await Promise.all([
        Promise.resolve(readLocal(collection)),
        getAccountData(collection.key),
      ]);
      const merged = mergeAccountCollection(collection.key, local, remote.payload);
      writeLocal(collection, merged);
      await putAccountData(collection.key, merged);
    }
    localStorage.setItem(OWNER_STORAGE_KEY, email);
  })().finally(() => accountJobs.delete(email));
  accountJobs.set(email, job);
  return job;
}

/** Keep the account copy updated after local garden changes; localStorage remains the offline fallback. */
export function startAccountSync() {
  let active = true;
  let authenticated = false;
  let currentUser = null;
  let synchronizing = false;
  let changedDuringSync = false;
  let timer;

  const hydrate = async () => {
    if (!active || !authenticated || synchronizing) return;
    synchronizing = true;
    try {
      await hydrateAccount(currentUser);
    } catch {
      // Local storage remains usable offline; the explicit account panel reports sync failures.
    } finally {
      synchronizing = false;
      if (changedDuringSync) {
        changedDuringSync = false;
        scheduleSync();
      }
    }
  };

  const scheduleSync = () => {
    if (!active || !authenticated) return;
    if (synchronizing) {
      changedDuringSync = true;
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { void syncAccountCollections().catch(() => {}); }, 350);
  };

  const onSession = (event) => {
    currentUser = event.detail?.user || null;
    authenticated = Boolean(currentUser);
    if (authenticated) void hydrate();
    else window.clearTimeout(timer);
  };
  const onStorageChange = (event) => {
    if (ACCOUNT_COLLECTIONS.some((collection) => collection.event === event.type)) scheduleSync();
  };
  const onStorage = (event) => {
    if (ACCOUNT_COLLECTIONS.some((collection) => collection.storage === event.key)) scheduleSync();
  };

  window.addEventListener('garden:account-session-changed', onSession);
  ACCOUNT_COLLECTIONS.forEach((collection) => window.addEventListener(collection.event, onStorageChange));
  window.addEventListener('storage', onStorage);
  getAccount().then(({ user }) => {
    if (!active) return;
    currentUser = user || null;
    authenticated = Boolean(user);
    if (authenticated) void hydrate();
  }).catch(() => {});

  return () => {
    active = false;
    window.clearTimeout(timer);
    window.removeEventListener('garden:account-session-changed', onSession);
    ACCOUNT_COLLECTIONS.forEach((collection) => window.removeEventListener(collection.event, onStorageChange));
    window.removeEventListener('storage', onStorage);
  };
}
