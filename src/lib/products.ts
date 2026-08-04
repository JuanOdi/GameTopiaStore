import { get, onValue, push, ref, remove, set, update } from 'firebase/database';

import { db } from './firebase';

export type AddOn = {
  name: string;
  price: number;
  quantity?: number;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  category: string;
  color?: string;
  stock: number;
  requiresConfirmation?: boolean;
  addOns?: AddOn[];
  createdAt?: number;
};

export async function seedSampleProducts() {
  const productsRef = ref(db, 'products');
  const snapshot = await get(productsRef);
  if (snapshot.exists()) return;

  const samples = [
    {
      name: 'Burger Meal',
      price: 159.00,
      image: 'https://picsum.photos/seed/burger/400/300',
      description: 'Juicy beef patty with fresh lettuce, tomato, and our special sauce.',
      category: 'Meals',
      stock: 50,
    },
    {
      name: 'Chicken Rice Bowl',
      price: 129.00,
      image: 'https://picsum.photos/seed/chickenrice/400/300',
      description: 'Tender grilled chicken over steamed rice with garlic sauce.',
      category: 'Meals',
      stock: 30,
    },
    {
      name: 'Mango Shake',
      price: 79.00,
      image: 'https://picsum.photos/seed/mangoshake/400/300',
      description: 'Fresh blended mango with milk and a hint of sweetness.',
      category: 'Drinks',
      stock: 40,
    },
  ];

  for (const product of samples) {
    const newRef = push(productsRef);
    await set(newRef, { ...product, createdAt: Date.now() });
  }
}

export async function addProduct(product: Omit<Product, 'id'>) {
  const newRef = push(ref(db, 'products'));
  await set(newRef, { ...product, createdAt: Date.now() });
}

export async function updateProduct(productId: string, data: Partial<Omit<Product, 'id'>>) {
  await update(ref(db, `products/${productId}`), data);
}

export async function decreaseStock(productId: string, quantity: number) {
  const snapshot = await get(ref(db, `products/${productId}/stock`));
  const current = snapshot.val() ?? 0;
  await update(ref(db, `products/${productId}`), { stock: Math.max(0, current - quantity) });
}

export async function deleteProduct(productId: string) {
  await remove(ref(db, `products/${productId}`));
}

function normalizeProduct(id: string, val: any): Product {
  return {
    ...val,
    id,
    addOns: val.addOns
      ? Array.isArray(val.addOns)
        ? val.addOns
        : Object.values(val.addOns)
      : [],
  };
}

export function subscribeToProducts(callback: (products: Product[]) => void) {
  const productsRef = ref(db, 'products');
  return onValue(productsRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const products: Product[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => normalizeProduct(id, val))
      .filter((p) => p.stock > 0);
    callback(products);
  });
}

export function subscribeToAllProducts(callback: (products: Product[]) => void) {
  const productsRef = ref(db, 'products');
  return onValue(productsRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const products: Product[] = Object.entries(snapshot.val())
      .map(([id, val]: any) => normalizeProduct(id, val));
    callback(products);
  });
}
