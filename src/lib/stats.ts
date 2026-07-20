import { get, onValue, ref, remove, runTransaction, set } from 'firebase/database';

import { db } from './firebase';

// PHT = UTC+8, but day boundary is 4 AM PHT (midnight–4am still counts as previous day)
function getPHTDate(): string {
  const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000); // UTC+4 shifts so 4am PHT = new day
  return shifted.toISOString().slice(0, 10);
}

// ── Daily Revenue ─────────────────────────────────────────────────────────────

export async function recordRevenue(amount: number, date?: string): Promise<void> {
  const key = date ?? getPHTDate();
  const r = ref(db, `stats/daily/${key}/revenue`);
  await runTransaction(r, (current) => (current ?? 0) + amount);
}

export async function resetTodayRevenue(): Promise<void> {
  const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const todayKey = shifted.toISOString().slice(0, 10);
  await remove(ref(db, `stats/daily/${todayKey}`));
}

export async function resetTodayGCashFees(): Promise<void> {
  await set(ref(db, `stats/daily/${getPHTDate()}/gcashFeeResetAt`), Date.now());
}

export async function resetTodayPrintEarnings(): Promise<void> {
  await set(ref(db, `stats/daily/${getPHTDate()}/printEarningResetAt`), Date.now());
}

export function subscribeToTodayResets(
  callback: (gcashResetAt: number, printResetAt: number) => void
) {
  const todayKey = getPHTDate();
  let g = 0, p = 0;
  const u1 = onValue(ref(db, `stats/daily/${todayKey}/gcashFeeResetAt`), snap => {
    g = snap.val() ?? 0; callback(g, p);
  });
  const u2 = onValue(ref(db, `stats/daily/${todayKey}/printEarningResetAt`), snap => {
    p = snap.val() ?? 0; callback(g, p);
  });
  return () => { u1(); u2(); };
}

export function subscribeToWeeklyRevenue(
  callback: (bars: { date: string; day: string; value: number }[]) => void
) {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 4 * 60 * 60 * 1000 - i * 86400000);
    keys.push(d.toISOString().slice(0, 10));
  }

  const unsubscribers: (() => void)[] = [];
  const values: Record<string, number> = {};

  function emit() {
    const bars = keys.map((key) => {
      const d = new Date(key + 'T00:00:00+08:00');
      const day = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
      return { date: key, day, value: values[key] ?? 0 };
    });
    callback(bars);
  }

  keys.forEach((key) => {
    const unsub = onValue(ref(db, `stats/daily/${key}/revenue`), (snap) => {
      values[key] = snap.val() ?? 0;
      emit();
    });
    unsubscribers.push(unsub);
  });

  return () => unsubscribers.forEach((u) => u());
}

// ── Customer Stats ────────────────────────────────────────────────────────────

export type CustomerStat = {
  userId: string;
  email: string;
  orders: number;
  completed: number;
  pending: number;
  spent: number;
};

export async function recordCustomerOrder(
  userId: string,
  email: string,
  isCompleted: boolean,
  isPending: boolean,
  amount: number
): Promise<void> {
  const r = ref(db, `stats/customers/${userId}`);
  await runTransaction(r, (current) => {
    const c = current ?? { userId, email, orders: 0, completed: 0, pending: 0, spent: 0 };
    c.userId = userId;
    c.email = email;
    c.orders = (c.orders ?? 0) + 1;
    if (isCompleted) { c.completed = (c.completed ?? 0) + 1; c.spent = (c.spent ?? 0) + amount; }
    if (isPending) c.pending = (c.pending ?? 0) + 1;
    return c;
  });
}

export async function updateCustomerOnComplete(
  userId: string,
  amount: number
): Promise<void> {
  const r = ref(db, `stats/customers/${userId}`);
  await runTransaction(r, (current) => {
    if (!current) return current;
    current.completed = (current.completed ?? 0) + 1;
    current.pending = Math.max(0, (current.pending ?? 1) - 1);
    current.spent = (current.spent ?? 0) + amount;
    return current;
  });
}

export async function updateCustomerOnCancel(userId: string): Promise<void> {
  const r = ref(db, `stats/customers/${userId}`);
  await runTransaction(r, (current) => {
    if (!current) return current;
    current.pending = Math.max(0, (current.pending ?? 1) - 1);
    return current;
  });
}

export function subscribeToCustomerStats(
  callback: (customers: CustomerStat[]) => void
) {
  return onValue(ref(db, 'stats/customers'), (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const list: CustomerStat[] = Object.values(snap.val());
    list.sort((a, b) => b.completed - a.completed);
    callback(list);
  });
}

export async function deleteCustomerStats(): Promise<void> {
  await remove(ref(db, 'stats/customers'));
}
