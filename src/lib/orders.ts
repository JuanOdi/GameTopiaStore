import { get, onValue, push, ref, remove, set, update } from 'firebase/database';

import { type AddOn, type Product, decreaseStock } from './products';
import { incrementProductStat } from './product-stats';
import { recordCustomerOrder, recordRevenue, updateCustomerOnCancel, updateCustomerOnComplete } from './stats';
import { db } from './firebase';

export type Order = {
  id: string;
  userId: string;
  userEmail: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  addOns: AddOn[];
  addOnsTotal: number;
  total: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  note?: string;
  createdAt: number;
  lastNotifiedAt?: number;
  isCustom?: boolean;
  paymentStatus: 'cash' | 'gcash' | 'unpaid';
  unpaidReason?: string;
  cancelReason?: string;
};

export async function createOrder(
  userId: string,
  userEmail: string,
  product: Product,
  quantity: number,
  addOns: AddOn[] = [],
  note: string = '',
  isCustom: boolean = false,
  paymentStatus: 'cash' | 'gcash' | 'unpaid' = 'cash',
  unpaidReason: string = ''
) {
  const addOnsTotal = addOns.reduce((sum, a) => sum + a.price * (a.quantity ?? 1), 0);
  const ordersRef = ref(db, 'orders');
  const newRef = push(ordersRef);
  const absTotal = (product.price * quantity) + addOnsTotal;
  const total = paymentStatus === 'unpaid' ? -absTotal : absTotal;
  await set(newRef, {
    userId,
    userEmail,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    price: product.price,
    quantity,
    addOns,
    addOnsTotal,
    total,
    status: product.requiresConfirmation ? 'pending' : 'completed',
    note: note.trim(),
    createdAt: Date.now(),
    isCustom: isCustom || false,
    paymentStatus,
    unpaidReason: unpaidReason.trim(),
  });
  const isCompleted = !product.requiresConfirmation;
  const isPending = !!product.requiresConfirmation;
  if (isCompleted && paymentStatus !== 'unpaid') await recordRevenue(absTotal);
  await recordCustomerOrder(userId, userEmail, isCompleted, isPending, isCompleted ? absTotal : 0);
  if (!isCustom) {
    await decreaseStock(product.id, quantity);
    await incrementProductStat(product.id, product.name, quantity, total);
  }
}

export function subscribeToOrders(callback: (orders: Order[]) => void) {
  const ordersRef = ref(db, 'orders');
  return onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const orders: Order[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => ({ id, ...val }))
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(orders);
  });
}

export function subscribeToUserOrders(userId: string, callback: (orders: Order[]) => void) {
  const ordersRef = ref(db, 'orders');
  return onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const orders: Order[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => ({ id, ...val }))
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(orders);
  });
}

export async function updateOrderStatus(orderId: string, status: Order['status'], cancelReason?: string) {
  const snap = await get(ref(db, `orders/${orderId}`));
  const order = snap.val() as Order | null;
  const updateData: Record<string, any> = { status };
  if (status === 'cancelled' && cancelReason !== undefined) updateData.cancelReason = cancelReason;
  await update(ref(db, `orders/${orderId}`), updateData);
  if (!order) return;
  if ((status === 'completed' || status === 'confirmed') && order.status === 'pending') {
    if (order.paymentStatus !== 'unpaid') await recordRevenue(Math.abs(order.total));
    await updateCustomerOnComplete(order.userId, Math.abs(order.total));
  }
  if (status === 'cancelled' && order.status === 'pending') {
    await updateCustomerOnCancel(order.userId);
  }
}

export async function markOrderPaid(orderId: string, method: 'cash' | 'gcash') {
  const snap = await get(ref(db, `orders/${orderId}`));
  const order = snap.val() as Order | null;
  if (!order || order.paymentStatus !== 'unpaid') return;
  const absTotal = Math.abs(order.total);
  await update(ref(db, `orders/${orderId}`), { paymentStatus: method, total: absTotal });
  if (order.status === 'completed' || order.status === 'confirmed') {
    await recordRevenue(absTotal);
  }
  if (!order.isCustom) {
    // Creation logged -absTotal into product stats for unpaid orders; +2x flips it to +absTotal
    await incrementProductStat(order.productId, order.productName, 0, absTotal * 2);
  }
}

export async function notifyAdmin(orderId: string) {
  await update(ref(db, `orders/${orderId}`), { lastNotifiedAt: Date.now() });
}

export async function deleteOrder(orderId: string) {
  await remove(ref(db, `orders/${orderId}`));
}

export async function deleteAllOrders() {
  await remove(ref(db, 'orders'));
}

export async function deleteProcessedOrders() {
  const snapshot = await get(ref(db, 'orders'));
  if (!snapshot.exists()) return;
  const updates: Record<string, null> = {};
  Object.entries(snapshot.val()).forEach(([id, order]: any) => {
    if (order.status === 'completed' || order.status === 'cancelled') {
      updates[id] = null;
    }
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(db, 'orders'), updates);
  }
}

function getPHTInfo(): { weekKey: string; hour: number; day: number } {
  const pht = new Date(Date.now() + 8 * 60 * 60 * 1000);
  // ISO week key: year + week number (e.g. "2025-W22")
  const startOfYear = new Date(Date.UTC(pht.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((pht.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  const weekKey = `${pht.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  return { weekKey, hour: pht.getUTCHours(), day: pht.getUTCDay() }; // day: 0=Sun, 1=Mon
}

export async function runWeeklyCleanupIfNeeded() {
  const { weekKey, hour, day } = getPHTInfo();
  // Only run on Monday (day === 1) at or after 10 AM PHT
  if (day !== 1 || hour < 10) return;
  const snapshot = await get(ref(db, 'orderCleanup/lastWeek'));
  if (snapshot.val() === weekKey) return;
  await deleteProcessedOrders();
  await set(ref(db, 'orderCleanup/lastWeek'), weekKey);
}
