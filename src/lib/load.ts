import { onValue, push, ref, remove, set, update } from 'firebase/database';

import { db } from './firebase';

export type LoadRequest = {
  id: string;
  userId: string;
  userEmail: string;
  network: string;
  phone: string;
  amount: number;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
};

export async function createLoadRequest(
  userId: string,
  userEmail: string,
  network: string,
  phone: string,
  amount: number,
  note: string = ''
) {
  const newRef = push(ref(db, 'loadRequests'));
  await set(newRef, {
    userId,
    userEmail,
    network,
    phone,
    amount,
    note: note.trim(),
    status: 'pending',
    createdAt: Date.now(),
  });
}

export function subscribeToUserLoadRequests(
  userId: string,
  callback: (requests: LoadRequest[]) => void
) {
  return onValue(ref(db, 'loadRequests'), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    callback(
      Object.entries(snapshot.val())
        .map(([id, val]: any) => ({ id, ...val }))
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  });
}

export function subscribeToAllLoadRequests(callback: (requests: LoadRequest[]) => void) {
  return onValue(ref(db, 'loadRequests'), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    callback(
      Object.entries(snapshot.val())
        .map(([id, val]: any) => ({ id, ...val }))
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  });
}

export async function updateLoadRequestStatus(id: string, status: LoadRequest['status']) {
  await update(ref(db, `loadRequests/${id}`), { status });
}

export async function deleteAllLoadRequests(): Promise<void> {
  await remove(ref(db, 'loadRequests'));
}
