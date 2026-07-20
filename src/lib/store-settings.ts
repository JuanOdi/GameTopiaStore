import { onValue, ref, set } from 'firebase/database';

import { db } from './firebase';

const AUTO_OPEN_HOUR = 8; // 8 AM Philippine Time (UTC+8)

type StoreSettings = {
  isOpen: boolean;
  manualOverrideDate: string | null; // 'YYYY-MM-DD' in PHT
  autoOpenHour: number;
};

function getPHT(): { date: string; hour: number } {
  const utcMs = Date.now();
  // PHT = UTC+8
  const pht = new Date(utcMs + 8 * 60 * 60 * 1000);
  const date = pht.toISOString().slice(0, 10);
  const hour = pht.getUTCHours();
  return { date, hour };
}

function computeIsOpen(settings: StoreSettings): boolean {
  const { date, hour } = getPHT();
  // Admin manually set today → respect their choice
  if (settings.manualOverrideDate === date) return settings.isOpen;
  // No manual override today → auto-schedule
  return hour >= settings.autoOpenHour;
}

export function subscribeToStoreStatus(callback: (isOpen: boolean) => void) {
  let latest: StoreSettings = { isOpen: true, manualOverrideDate: null, autoOpenHour: AUTO_OPEN_HOUR };

  const unsub = onValue(ref(db, 'storeSettings'), (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      latest = {
        isOpen: val.isOpen ?? true,
        manualOverrideDate: val.manualOverrideDate ?? null,
        autoOpenHour: val.autoOpenHour ?? AUTO_OPEN_HOUR,
      };
    }
    callback(computeIsOpen(latest));
  });

  // Re-evaluate every minute so the 8 AM switch happens automatically
  const interval = setInterval(() => callback(computeIsOpen(latest)), 60_000);

  return () => {
    unsub();
    clearInterval(interval);
  };
}

export async function setStoreOpen(isOpen: boolean) {
  const { date } = getPHT();
  await set(ref(db, 'storeSettings'), {
    isOpen,
    manualOverrideDate: date,    // marks today as manually overridden
    autoOpenHour: AUTO_OPEN_HOUR,
  });
}
