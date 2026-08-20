import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';

import { db } from './firebase';

export type OnlineUser = {
  uid: string;
  email: string;
  onlineAt: number;
};

export function registerPresence(uid: string, email: string) {
  const presenceRef = ref(db, `presence/${uid}`);
  const connectedRef = ref(db, '.info/connected');

  // Re-arm on every (re)connect: onDisconnect handlers are lost when the socket drops
  const unsubscribe = onValue(connectedRef, (snap) => {
    if (!snap.val()) return;
    onDisconnect(presenceRef)
      .remove()
      .then(() => set(presenceRef, { email, onlineAt: Date.now() }))
      .catch(() => {});
  });

  return () => {
    unsubscribe();
    onDisconnect(presenceRef).cancel().catch(() => {});
    remove(presenceRef).catch(() => {});
  };
}

export function subscribeToOnlineUsers(callback: (users: OnlineUser[]) => void) {
  return onValue(ref(db, 'presence'), (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const list: OnlineUser[] = Object.entries(snap.val())
      .map(([uid, val]: any) => ({ uid, ...val }))
      .sort((a, b) => a.onlineAt - b.onlineAt);
    callback(list);
  });
}

export async function forceLogout(uid: string): Promise<void> {
  await set(ref(db, `users/${uid}/forceLogoutAt`), Date.now());
}

// Fires onKick only when the flag CHANGES after subscribing, so a stale flag
// from a past kick can't sign the user out again on their next login.
export function subscribeToForceLogout(uid: string, onKick: () => void) {
  let initialized = false;
  let lastSeen: number | null = null;
  return onValue(ref(db, `users/${uid}/forceLogoutAt`), (snap) => {
    const ts = snap.val() ?? null;
    if (!initialized) {
      initialized = true;
      lastSeen = ts;
      return;
    }
    if (ts !== null && ts !== lastSeen) {
      lastSeen = ts;
      onKick();
    }
  });
}
