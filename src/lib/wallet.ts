import { get, onValue, ref, set } from 'firebase/database';

import { db } from './firebase';

export function subscribeToBalance(userId: string, callback: (balance: number) => void) {
  return onValue(ref(db, `users/${userId}/balance`), (snapshot) => {
    callback(snapshot.val() ?? 0);
  });
}

export async function getBalance(userId: string): Promise<number> {
  const snapshot = await get(ref(db, `users/${userId}/balance`));
  return snapshot.val() ?? 0;
}

export async function adjustBalance(userId: string, delta: number) {
  const current = await getBalance(userId);
  await set(ref(db, `users/${userId}/balance`), Math.round((current + delta) * 100) / 100);
}
