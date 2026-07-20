import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { type CashRequest, type PrintRecord, subscribeToAllCashRequests, subscribeToAllPrintRecords } from '@/lib/gcash';
import { type Order, subscribeToOrders } from '@/lib/orders';
import { type CustomerStat, deleteCustomerStats, resetTodayGCashFees, resetTodayPrintEarnings, resetTodayRevenue, subscribeToCustomerStats, subscribeToTodayResets, subscribeToWeeklyRevenue } from '@/lib/stats';
import { type Product, subscribeToAllProducts, updateProduct } from '@/lib/products';
import { setStoreOpen, subscribeToStoreStatus } from '@/lib/store-settings';
import { C, F, R } from '@/lib/theme';

function MiniBarChart({ bars, color }: { bars: { day: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  return (
    <View style={styles.barChart}>
      {bars.map((b, i) => {
        const isToday = i === bars.length - 1;
        const barHeight = Math.max(4, (b.value / maxVal) * 52);
        return (
          <View key={i} style={styles.barColumn}>
            {b.value > 0 && (
              <Text style={[styles.barValue, { color: isToday ? color : C.muted2 }]}>
                {b.value >= 1000 ? `₱${(b.value / 1000).toFixed(1)}k` : `₱${b.value.toFixed(0)}`}
              </Text>
            )}
            <View style={[styles.bar, { height: barHeight, backgroundColor: isToday ? color : color + '73' }]} />
            <Text style={[styles.barLabel, isToday && { color, fontFamily: F.bold }]}>{b.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

function getStartOfTodayPHT(): number {
  // Day boundary is 4 AM PHT — midnight–4am counts as the previous business day
  const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const dateStr = shifted.toISOString().slice(0, 10);
  return new Date(dateStr + 'T04:00:00+08:00').getTime();
}

function computeStats(orders: Order[]) {
  const start = getStartOfTodayPHT();
  const filtered = orders.filter((o) => o.createdAt >= start);
  const completed = filtered.filter((o) => o.status === 'completed' || o.status === 'confirmed');
  return {
    total: filtered.length,
    completed: completed.length,
    cancelled: filtered.filter((o) => o.status === 'cancelled').length,
    pending: filtered.filter((o) => o.status === 'pending').length,
    revenue: completed.filter((o) => o.paymentStatus !== 'unpaid').reduce((sum, o) => sum + o.total, 0),
  };
}


const RESTOCK_PAGE_SIZE = 10;

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashRequests, setCashRequests] = useState<CashRequest[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [printRecords, setPrintRecords] = useState<PrintRecord[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [weeklyBars, setWeeklyBars] = useState<{ date: string; day: string; value: number }[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStat[]>([]);
  const [gcashResetAt, setGcashResetAt] = useState(0);
  const [printResetAt, setPrintResetAt] = useState(0);
  const [restockPage, setRestockPage] = useState(0);
  const [restockDrafts, setRestockDrafts] = useState<Record<string, number>>({});
  const [restockSearch, setRestockSearch] = useState('');
  const username = user?.email?.split('@')[0] ?? 'Admin';

  useEffect(() => {
    const unsubscribe = subscribeToOrders(setOrders);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToWeeklyRevenue(setWeeklyBars);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCustomerStats(setCustomerStats);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAllCashRequests(setCashRequests);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToStoreStatus(setIsOpen);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAllProducts(setAllProducts);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAllPrintRecords(setPrintRecords);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTodayResets((g, p) => {
      setGcashResetAt(g);
      setPrintResetAt(p);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setRestockPage(0);
  }, [restockSearch]);

  const stats = computeStats(orders);
  const zeroStockProducts = allProducts.filter((p) => p.stock === 0);
  const filteredRestockProducts = zeroStockProducts.filter((p) =>
    !restockSearch ||
    p.name.toLowerCase().includes(restockSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(restockSearch.toLowerCase())
  );
  const restockTotalPages = Math.max(1, Math.ceil(filteredRestockProducts.length / RESTOCK_PAGE_SIZE));
  const restockPageClamped = Math.min(restockPage, restockTotalPages - 1);
  const pagedRestockProducts = filteredRestockProducts.slice(
    restockPageClamped * RESTOCK_PAGE_SIZE,
    restockPageClamped * RESTOCK_PAGE_SIZE + RESTOCK_PAGE_SIZE
  );

  function adjustRestockDraft(productId: string, delta: number) {
    setRestockDrafts((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) }));
  }

  async function saveRestockDraft(productId: string) {
    const qty = restockDrafts[productId] ?? 0;
    if (qty <= 0) return;
    await updateProduct(productId, { stock: qty });
    setRestockDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  const bars = weeklyBars;
  const maxBarValue = Math.max(...bars.map((b) => b.value), 1);

  function getShiftedDateKey(ts: number) {
    return new Date(ts + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  const todayDateKey = getShiftedDateKey(Date.now());

  const gcashWeeklyBars = weeklyBars.map(b => ({
    ...b,
    value: cashRequests
      .filter(r =>
        r.status === 'approved' &&
        getShiftedDateKey(r.createdAt) === b.date &&
        !(b.date === todayDateKey && gcashResetAt > 0 && r.createdAt <= gcashResetAt)
      )
      .reduce((sum, r) => sum + (r.fee ?? 0), 0),
  }));

  const printWeeklyBars = weeklyBars.map(b => ({
    ...b,
    value: printRecords
      .filter(r =>
        getShiftedDateKey(r.createdAt) === b.date &&
        !(b.date === todayDateKey && printResetAt > 0 && r.createdAt <= printResetAt)
      )
      .reduce((sum, r) => sum + r.amount, 0),
  }));

  const gcashDoneCount = cashRequests.filter(
    r => r.status === 'approved' && weeklyBars.some(b => getShiftedDateKey(r.createdAt) === b.date)
  ).length;
  const printDoneCount = printRecords.filter(
    r => weeklyBars.some(b => getShiftedDateKey(r.createdAt) === b.date)
  ).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Topbar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.topbarAvatar}>
            <Text style={styles.topbarAvatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.topbarTextStack}>
            <Text style={styles.topbarGreeting}>Hi, {username} 👋</Text>
            <Text style={styles.topbarSub}>Here's today's overview</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setStoreOpen(!isOpen)}
          style={({ pressed }) => [
            styles.storePill,
            {
              backgroundColor: isOpen ? C.green + '1A' : C.coral + '1A',
              borderColor: isOpen ? C.green + '59' : C.coral + '59',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <View style={[styles.storePillDot, { backgroundColor: isOpen ? C.green : C.coral }]} />
          <Text style={[styles.storePillLabel, { color: isOpen ? C.green : C.coral }]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
        </Pressable>
      </View>

      {/* Hero Revenue Card */}
      <View style={[styles.heroCard, { marginBottom: 16 }]}>
        {/* Header row */}
        <View style={styles.heroCardHeader}>
          <Text style={styles.heroCardLabel}>REVENUE TODAY</Text>
          <View style={styles.heroCardHeaderRight}>
            <View style={styles.heroDoneChip}>
              <Text style={styles.heroDoneChipText}>{stats.completed} done</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.deleteAllBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (window.confirm("Reset today's earnings in the graph?")) resetTodayRevenue();
                } else {
                  Alert.alert("Reset Today's Earnings", "This clears today's bar in the graph. Orders are not deleted.", [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: resetTodayRevenue },
                  ]);
                }
              }}>
              <Text style={styles.deleteAllText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        {/* Big revenue number */}
        <Text style={styles.heroRevenue}>₱{stats.revenue.toFixed(2)}</Text>

        {/* 7-day bar chart — tap a bar to see that day's orders */}
        <View style={styles.barChart}>
          {bars.map((b, i) => {
            const isToday = i === 6;
            const barHeight = Math.max(4, (b.value / maxBarValue) * 52);
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.barColumn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/(app)/(admin)/orders', params: { date: b.date } } as any)}
              >
                {b.value > 0 && (
                  <Text style={[styles.barValue, { color: isToday ? C.amber : C.muted2 }]}>
                    {b.value >= 1000 ? `₱${(b.value / 1000).toFixed(1)}k` : `₱${b.value.toFixed(0)}`}
                  </Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isToday ? C.amber : C.amber + '73',
                    },
                  ]}
                />
                <Text style={[styles.barLabel, isToday && { color: C.amber, fontFamily: F.bold }]}>{b.day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Metric Strip */}
      <View style={[styles.metricStrip, { marginBottom: 16 }]}>
        {[
          { label: 'TOTAL', value: stats.total, color: C.text },
          { label: 'DONE', value: stats.completed, color: C.green },
          { label: 'PENDING', value: stats.pending, color: C.amber },
          { label: 'CANCEL', value: stats.cancelled, color: C.coral },
        ].map((s, i, arr) => (
          <View key={s.label} style={styles.metricColumn}>
            <Text style={[styles.metricValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.metricLabel}>{s.label}</Text>
            {i < arr.length - 1 && <View style={styles.metricDivider} />}
          </View>
        ))}
      </View>

      {/* GCash Fees Weekly Chart */}
      <View style={[styles.heroCard, { marginBottom: 12 }]}>
        <View style={styles.heroCardHeader}>
          <Text style={styles.heroCardLabel}>GCASH FEES · 7 DAYS</Text>
          <View style={styles.heroCardHeaderRight}>
            <View style={[styles.heroDoneChip, { backgroundColor: C.blue + '1A' }]}>
              <Text style={[styles.heroDoneChipText, { color: C.blue }]}>{gcashDoneCount} done</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.deleteAllBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (window.confirm("Reset today's GCash bar?")) resetTodayGCashFees();
                } else {
                  Alert.alert("Reset Today's GCash", "Clear today's GCash bar in the chart? History is not deleted.", [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: resetTodayGCashFees },
                  ]);
                }
              }}>
              <Text style={styles.deleteAllText}>Reset</Text>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.heroRevenue, { fontSize: 32, color: C.blue }]}>
          ₱{gcashWeeklyBars[gcashWeeklyBars.length - 1]?.value.toFixed(2) ?? '0.00'}
        </Text>
        <MiniBarChart bars={gcashWeeklyBars} color={C.blue} />
      </View>

      {/* Print Earnings Weekly Chart */}
      <View style={[styles.heroCard, { marginBottom: 16 }]}>
        <View style={styles.heroCardHeader}>
          <Text style={styles.heroCardLabel}>PRINT EARNINGS · 7 DAYS</Text>
          <View style={styles.heroCardHeaderRight}>
            <View style={[styles.heroDoneChip, { backgroundColor: C.green + '1A' }]}>
              <Text style={[styles.heroDoneChipText, { color: C.green }]}>{printDoneCount} done</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.deleteAllBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (window.confirm("Reset today's Print bar?")) resetTodayPrintEarnings();
                } else {
                  Alert.alert("Reset Today's Print", "Clear today's Print bar in the chart? History is not deleted.", [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: resetTodayPrintEarnings },
                  ]);
                }
              }}>
              <Text style={styles.deleteAllText}>Reset</Text>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.heroRevenue, { fontSize: 32, color: C.green }]}>
          ₱{printWeeklyBars[printWeeklyBars.length - 1]?.value.toFixed(2) ?? '0.00'}
        </Text>
        <MiniBarChart bars={printWeeklyBars} color={C.green} />
      </View>

      {/* Customers */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Customers</Text>
        {customerStats.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.deleteAllBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              if (Platform.OS === 'web') {
                if (window.confirm('Reset customer stats? Orders will NOT be deleted.')) deleteCustomerStats();
              } else {
                Alert.alert('Reset Customer Stats', 'This only clears the customer leaderboard. Orders and graph data will NOT be deleted.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: deleteCustomerStats },
                ]);
              }
            }}>
            <Text style={styles.deleteAllText}>Reset</Text>
          </Pressable>
        )}
      </View>
      {customerStats.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No customers yet</Text></View>
      ) : (
        customerStats.map((c, index) => {
          const initials = c.email.charAt(0).toUpperCase();
          const uname = c.email.split('@')[0];
          const isTop = index === 0;
          return (
            <View key={c.userId} style={[styles.customerCard, isTop && styles.customerCardTop]}>
              <View style={styles.customerLeft}>
                <View style={[styles.avatar, isTop && styles.avatarTop]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.customerInfo}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName}>{uname}</Text>
                    {isTop && (
                      <View style={styles.topBadge}>
                        <Text style={styles.topBadgeText}>TOP</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.customerEmail} numberOfLines={1}>{c.email}</Text>
                </View>
              </View>

              <View style={styles.customerStats}>
                <View style={styles.customerStat}>
                  <Text style={[styles.customerStatValue, { color: C.text }]}>{c.orders}</Text>
                  <Text style={styles.customerStatLabel}>Orders</Text>
                </View>
                <View style={styles.customerStat}>
                  <Text style={[styles.customerStatValue, { color: C.green }]}>{c.completed}</Text>
                  <Text style={styles.customerStatLabel}>Done</Text>
                </View>
                <View style={styles.customerStat}>
                  <Text style={[styles.customerStatValue, { color: C.amber }]}>{c.pending}</Text>
                  <Text style={styles.customerStatLabel}>Pending</Text>
                </View>
                <View style={styles.customerStat}>
                  <Text style={[styles.customerStatValue, { color: C.green }]}>₱{c.spent.toFixed(0)}</Text>
                  <Text style={styles.customerStatLabel}>Spent</Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Needs Restock */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Needs Restock</Text>
        {zeroStockProducts.length > 0 && (
          <View style={styles.restockBadge}>
            <Text style={styles.restockBadgeText}>{zeroStockProducts.length} out of stock</Text>
          </View>
        )}
      </View>
      {zeroStockProducts.length > 0 && (
        <View style={styles.restockSearchBar}>
          <Text style={styles.restockSearchIcon}>🔍</Text>
          <TextInput
            style={styles.restockSearchInput}
            placeholder="Search by name or category..."
            placeholderTextColor={C.muted2}
            value={restockSearch}
            onChangeText={setRestockSearch}
            autoCapitalize="none"
          />
          {restockSearch.length > 0 && (
            <Pressable onPress={() => setRestockSearch('')}>
              <Text style={styles.restockSearchClear}>✕</Text>
            </Pressable>
          )}
        </View>
      )}
      {zeroStockProducts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>All products have stock ✓</Text>
        </View>
      ) : filteredRestockProducts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No matching products</Text>
        </View>
      ) : (
        <>
          {pagedRestockProducts.map((p) => {
            const draft = restockDrafts[p.id] ?? 0;
            return (
              <View key={p.id} style={styles.restockRow}>
                <View style={styles.restockTopRow}>
                  <View style={styles.restockIconWrap}>
                    <Text style={styles.restockIcon}>📦</Text>
                  </View>
                  <View style={styles.restockInfo}>
                    <Text style={styles.restockName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.restockCategory}>{p.category}</Text>
                  </View>
                  <View style={styles.restockZero}>
                    <Text style={styles.restockZeroText}>0 left</Text>
                  </View>
                </View>
                <View style={styles.restockBottomRow}>
                  <View style={styles.qtyStepper}>
                    <Pressable
                      style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => adjustRestockDraft(p.id, -1)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{draft}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => adjustRestockDraft(p.id, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    disabled={draft === 0}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      draft === 0 && styles.saveBtnDisabled,
                      pressed && draft > 0 && { opacity: 0.7 },
                    ]}
                    onPress={() => saveRestockDraft(p.id)}
                  >
                    <Text style={[styles.saveBtnText, draft === 0 && styles.saveBtnTextDisabled]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {filteredRestockProducts.length > RESTOCK_PAGE_SIZE && (
            <View style={styles.pagination}>
              <Pressable
                disabled={restockPageClamped === 0}
                onPress={() => setRestockPage(Math.max(0, restockPageClamped - 1))}
                style={({ pressed }) => [
                  styles.pageBtn,
                  restockPageClamped === 0 && styles.pageBtnDisabled,
                  pressed && restockPageClamped > 0 && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.pageBtnText}>Prev</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>{restockPageClamped + 1} / {restockTotalPages}</Text>
              <Pressable
                disabled={restockPageClamped >= restockTotalPages - 1}
                onPress={() => setRestockPage(Math.min(restockTotalPages - 1, restockPageClamped + 1))}
                style={({ pressed }) => [
                  styles.pageBtn,
                  restockPageClamped >= restockTotalPages - 1 && styles.pageBtnDisabled,
                  pressed && restockPageClamped < restockTotalPages - 1 && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 120 },

  // Topbar
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topbarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topbarAvatarText: { color: '#0f0e0d', fontSize: 16, fontFamily: F.extraBold },
  topbarTextStack: { gap: 2 },
  topbarGreeting: { color: C.text, fontSize: 17, fontFamily: F.extraBold },
  topbarSub: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storePillDot: { width: 8, height: 8, borderRadius: 4 },
  storePillLabel: { fontSize: 13, fontFamily: F.bold },

  // Hero Revenue Card
  heroCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 12,
  },
  heroCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCardLabel: {
    color: C.muted2,
    fontSize: 10.5,
    fontFamily: F.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroDoneChip: {
    backgroundColor: C.green + '1A',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroDoneChipText: { color: C.green, fontSize: 11, fontFamily: F.bold },
  heroRevenue: {
    color: C.green,
    fontSize: 40,
    fontFamily: F.extraBold,
    letterSpacing: -1.4,
  },
  barChart: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center', gap: 4 },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: { color: C.muted2, fontSize: 10, fontFamily: F.bold, textAlign: 'center' },
  barValue: { fontSize: 8, fontFamily: F.bold, textAlign: 'center' },


  // Metric Strip
  metricStrip: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: 'row',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  metricValue: { fontSize: 22, fontFamily: F.extraBold, letterSpacing: -0.4 },
  metricLabel: {
    color: C.muted2,
    fontSize: 10,
    fontFamily: F.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  metricDivider: {
    position: 'absolute',
    right: 0,
    top: '10%',
    bottom: '10%',
    width: 1,
    backgroundColor: C.line,
  },

  // Section title
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  deleteAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.coral + '88',
    backgroundColor: C.coral + '1A',
  },
  deleteAllText: { color: C.coral, fontSize: 12, fontFamily: F.bold },
  sectionTitle: {
    color: C.muted2,
    fontSize: 11,
    fontFamily: F.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: { alignItems: 'center', padding: 20 },
  emptyText: { color: C.muted2, fontSize: 14, fontFamily: F.medium },

  // Customer cards
  customerCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  customerCardTop: { borderColor: C.amber },
  customerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTop: { borderWidth: 2, borderColor: C.amber, backgroundColor: C.amber + '1A' },
  avatarText: { color: C.text, fontSize: 18, fontFamily: F.extraBold },
  customerInfo: { flex: 1, gap: 2 },
  customerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customerName: { color: C.text, fontSize: 15, fontFamily: F.bold },
  topBadge: { backgroundColor: C.amber, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  topBadgeText: { color: '#0f0e0d', fontSize: 10, fontFamily: F.bold },
  customerEmail: { color: C.muted2, fontSize: 12 },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
  },
  customerStat: { alignItems: 'center', gap: 2 },
  customerStatValue: { fontSize: 16, fontFamily: F.extraBold },
  customerStatLabel: { color: C.muted2, fontSize: 11 },

  // Needs Restock
  restockBadge: {
    backgroundColor: C.coral + '1A',
    borderWidth: 1,
    borderColor: C.coral + '55',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  restockBadgeText: { color: C.coral, fontSize: 11, fontFamily: F.bold },
  restockSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.input,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  restockSearchIcon: { color: C.muted2, fontSize: 16, marginRight: 8 },
  restockSearchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 12, fontFamily: F.medium },
  restockSearchClear: { color: C.muted2, fontSize: 16, padding: 4 },
  restockRow: {
    backgroundColor: C.surface,
    borderRadius: R.btn,
    padding: 14,
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.coral + '44',
    borderLeftWidth: 3,
    borderLeftColor: C.coral,
  },
  restockTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restockBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
  },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { color: C.text, fontSize: 16, fontFamily: F.bold },
  qtyValue: { color: C.text, fontSize: 15, fontFamily: F.extraBold, minWidth: 24, textAlign: 'center' },
  saveBtn: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnDisabled: { backgroundColor: C.surface2 },
  saveBtnText: { color: '#0f0e0d', fontSize: 12, fontFamily: F.bold },
  saveBtnTextDisabled: { color: C.muted2 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: C.text, fontSize: 13, fontFamily: F.bold },
  pageIndicator: { color: C.muted2, fontSize: 13, fontFamily: F.bold },
  restockIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.coral + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restockIcon: { fontSize: 18 },
  restockInfo: { flex: 1, gap: 2 },
  restockName: { color: C.text, fontSize: 14, fontFamily: F.bold },
  restockCategory: { color: C.muted2, fontSize: 12, fontFamily: F.medium },
  restockZero: {
    backgroundColor: C.coral + '1A',
    borderWidth: 1,
    borderColor: C.coral + '55',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  restockZeroText: { color: C.coral, fontSize: 12, fontFamily: F.extraBold },
});
