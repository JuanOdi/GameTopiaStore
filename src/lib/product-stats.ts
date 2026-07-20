import { get, onValue, ref, remove, set } from 'firebase/database';

import { db } from './firebase';

export type ProductStatEntry = {
  productId: string;
  productName: string;
  totalQty: number;
  totalRevenue: number;
};

function getCurrentMonthKey(): string {
  const pht = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return pht.toISOString().slice(0, 7); // YYYY-MM
}

export async function incrementProductStat(
  productId: string,
  productName: string,
  qty: number,
  revenue: number
) {
  const monthKey = getCurrentMonthKey();
  const statRef = ref(db, `productStats/${monthKey}/${productId}`);
  const snapshot = await get(statRef);
  const current: ProductStatEntry = snapshot.val() ?? { productId, productName, totalQty: 0, totalRevenue: 0 };
  await set(statRef, {
    productId,
    productName,
    totalQty: current.totalQty + qty,
    totalRevenue: current.totalRevenue + revenue,
  });
}

export async function deleteProductStats(): Promise<void> {
  const monthKey = getCurrentMonthKey();
  await remove(ref(db, `productStats/${monthKey}`));
}

export function subscribeToMonthlyTopProducts(callback: (products: ProductStatEntry[]) => void) {
  const monthKey = getCurrentMonthKey();
  const statsRef = ref(db, `productStats/${monthKey}`);
  return onValue(statsRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const entries: ProductStatEntry[] = Object.values(snapshot.val() as Record<string, ProductStatEntry>)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);
    callback(entries);
  });
}
