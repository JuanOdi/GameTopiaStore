import { get, onValue, push, ref, remove, set, update } from 'firebase/database';

import { db } from './firebase';

export type CashRequest = {
  id: string;
  userId: string;
  userEmail: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  withFee: boolean;
  fee: number;
  total: number;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  lastNotifiedAt?: number;
};

export function computeFee(amount: number): number {
  if (amount <= 0) return 0;
  return Math.min(Math.ceil(amount / 500) * 10, 200);
}

export async function createCashRequest(
  userId: string,
  userEmail: string,
  type: CashRequest['type'],
  amount: number,
  withFee: boolean,
  note: string = ''
) {
  const fee = computeFee(amount);
  // netAmount = exact amount admin processes; fee is always earned by admin
  const netAmount = withFee ? amount : amount - fee;
  const total     = withFee ? amount + fee : amount; // what user pays/provides
  const newRef = push(ref(db, 'cashRequests'));
  await set(newRef, {
    userId,
    userEmail,
    type,
    amount: netAmount,
    withFee,
    fee,
    total,
    note: note.trim(),
    status: 'pending',
    createdAt: Date.now(),
  });
}

export function subscribeToUserCashRequests(userId: string, callback: (requests: CashRequest[]) => void) {
  const reqRef = ref(db, 'cashRequests');
  return onValue(reqRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const requests: CashRequest[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => ({ id, ...val }))
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(requests);
  });
}

export function subscribeToAllCashRequests(callback: (requests: CashRequest[]) => void) {
  const reqRef = ref(db, 'cashRequests');
  return onValue(reqRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const requests: CashRequest[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => ({ id, ...val }))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(requests);
  });
}

export async function updateCashRequestStatus(requestId: string, status: CashRequest['status']) {
  await update(ref(db, `cashRequests/${requestId}`), { status });
}

export async function notifyAdminCash(requestId: string) {
  await update(ref(db, `cashRequests/${requestId}`), { lastNotifiedAt: Date.now() });
}

export async function deleteAllCashRequests() {
  await remove(ref(db, 'cashRequests'));
}

function shiftedDateKey(ts: number) {
  return new Date(ts + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function deleteTodayCashRequests(): Promise<void> {
  const todayKey = shiftedDateKey(Date.now());
  const snapshot = await get(ref(db, 'cashRequests'));
  if (!snapshot.exists()) return;
  await Promise.all(
    (Object.entries(snapshot.val()) as [string, any][])
      .filter(([, val]) => shiftedDateKey(val.createdAt) === todayKey)
      .map(([id]) => remove(ref(db, `cashRequests/${id}`)))
  );
}

// ── Print Records ─────────────────────────────────────────────────────────────

export type PrintRecord = {
  id: string;
  userId: string;
  userEmail: string;
  customerName: string;
  amount: number;
  withGcash: boolean;
  gcashRef?: string;
  note?: string;
  createdAt: number;
};

export async function createPrintRecord(
  userId: string,
  userEmail: string,
  customerName: string,
  amount: number,
  withGcash: boolean,
  gcashRef: string = '',
  note: string = ''
) {
  const newRef = push(ref(db, 'printRecords'));
  await set(newRef, {
    userId,
    userEmail,
    customerName: customerName.trim(),
    amount,
    withGcash,
    gcashRef: gcashRef.trim(),
    note: note.trim(),
    createdAt: Date.now(),
  });
}

export function subscribeToUserPrintRecords(userId: string, callback: (records: PrintRecord[]) => void) {
  return onValue(ref(db, 'printRecords'), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    callback(
      Object.entries(snapshot.val())
        .map(([id, val]: any) => ({ id, ...val }))
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  });
}

export function subscribeToAllPrintRecords(callback: (records: PrintRecord[]) => void) {
  return onValue(ref(db, 'printRecords'), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    callback(
      Object.entries(snapshot.val())
        .map(([id, val]: any) => ({ id, ...val }))
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  });
}

export async function deleteUserPrintRecords(userId: string): Promise<void> {
  const snapshot = await get(ref(db, 'printRecords'));
  if (!snapshot.exists()) return;
  const entries = Object.entries(snapshot.val()) as [string, any][];
  await Promise.all(
    entries
      .filter(([, val]) => val.userId === userId)
      .map(([id]) => remove(ref(db, `printRecords/${id}`)))
  );
}

export async function deleteAllPrintRecords(): Promise<void> {
  await remove(ref(db, 'printRecords'));
}

export async function deleteTodayPrintRecords(): Promise<void> {
  const todayKey = shiftedDateKey(Date.now());
  const snapshot = await get(ref(db, 'printRecords'));
  if (!snapshot.exists()) return;
  await Promise.all(
    (Object.entries(snapshot.val()) as [string, any][])
      .filter(([, val]) => shiftedDateKey(val.createdAt) === todayKey)
      .map(([id]) => remove(ref(db, `printRecords/${id}`)))
  );
}
