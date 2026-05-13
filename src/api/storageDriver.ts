import { STORAGE_DRIVER, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

const DATABASE_KEYS = [
  'manageMe:users',
  'manageMe:projects',
  'manageMe:stories',
  'manageMe:tasks',
  'manageMe:notifications',
  'manageMe:story_uid',
  'manageMe:task_uid',
];

type StorageRecord = {
  key: string;
  value: string | null;
};

const isSupabaseEnabled = () => STORAGE_DRIVER === 'supabase';

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const endpoint = (query = '') => `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_storage${query}`;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export async function hydrateDatabaseStorage(): Promise<void> {
  if (!isSupabaseEnabled()) return;
  if (!isConfigured()) {
    console.error('ManageMe: Supabase storage selected, but URL or anon key is missing.');
    return;
  }

  try {
    const res = await fetch(endpoint('?select=key,value'), { headers });
    if (!res.ok) throw new Error(await res.text());
    const rows = (await res.json()) as StorageRecord[];
    rows.forEach((row) => {
      if (DATABASE_KEYS.includes(row.key) && row.value !== null) {
        localStorage.setItem(row.key, row.value);
      }
    });
  } catch (err) {
    console.error('ManageMe: failed to hydrate data from Supabase.', err);
  }
}

export function storageSetItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  void persistStorageKey(key, value);
}

export function storageRemoveItem(key: string): void {
  localStorage.removeItem(key);
  void removeStorageKey(key);
}

async function persistStorageKey(key: string, value: string): Promise<void> {
  if (!isSupabaseEnabled() || !DATABASE_KEYS.includes(key) || !isConfigured()) return;

  try {
    const res = await fetch(endpoint('?on_conflict=key'), {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    console.error(`ManageMe: failed to persist ${key} to Supabase.`, err);
  }
}

async function removeStorageKey(key: string): Promise<void> {
  if (!isSupabaseEnabled() || !DATABASE_KEYS.includes(key) || !isConfigured()) return;

  try {
    const res = await fetch(endpoint(`?key=eq.${encodeURIComponent(key)}`), {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    console.error(`ManageMe: failed to remove ${key} from Supabase.`, err);
  }
}
