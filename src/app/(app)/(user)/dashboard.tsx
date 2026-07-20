import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { type Order, subscribeToUserOrders } from '@/lib/orders';
import { C, F, R } from '@/lib/theme';

function getShiftedDateKey(ts: number) {
  return new Date(ts + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildWeekBars(orders: Order[]) {
  const bars: { date: string; day: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000 - i * 86400000);
    const date = shifted.toISOString().slice(0, 10);
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][shifted.getUTCDay()];
    const value = orders
      .filter(o =>
        getShiftedDateKey(o.createdAt) === date &&
        o.paymentStatus !== 'unpaid' &&
        (o.status === 'completed' || o.status === 'confirmed')
      )
      .reduce((s, o) => s + Math.abs(o.total), 0);
    bars.push({ date, day, value });
  }
  return bars;
}

function BarChart({ bars }: { bars: { day: string; value: number }[] }) {
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  return (
    <View style={styles.barChart}>
      {bars.map((b, i) => {
        const isToday = i === bars.length - 1;
        const barHeight = Math.max(4, (b.value / maxVal) * 80);
        return (
          <View key={i} style={styles.barColumn}>
            {b.value > 0 && (
              <Text style={[styles.barValue, { color: isToday ? C.amber : C.muted2 }]}>
                {b.value >= 1000 ? `₱${(b.value / 1000).toFixed(1)}k` : `₱${b.value.toFixed(0)}`}
              </Text>
            )}
            <View
              style={[
                styles.bar,
                { height: barHeight, backgroundColor: isToday ? C.amber : C.amber + '55' },
              ]}
            />
            <Text style={[styles.barLabel, isToday && { color: C.amber, fontFamily: F.bold }]}>
              {b.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const STATUS_COLOR: Record<Order['status'], string> = {
  pending:   C.amber,
  confirmed: C.blue,
  completed: C.green,
  cancelled: C.coral,
};
const STATUS_LABEL: Record<Order['status'], string> = {
  pending:   'PENDING',
  confirmed: 'CONFIRMED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserOrders(user.uid, setOrders);
  }, [user]);

  const username = user?.email?.split('@')[0] ?? '';
  const todayKey = getShiftedDateKey(Date.now());

  const todayOrders  = orders.filter(o => getShiftedDateKey(o.createdAt) === todayKey);
  const todaySpent   = todayOrders
    .filter(o => o.paymentStatus !== 'unpaid' && (o.status === 'completed' || o.status === 'confirmed'))
    .reduce((s, o) => s + Math.abs(o.total), 0);
  const todayCount   = todayOrders.length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const weekBars    = buildWeekBars(orders);
  const weekTotal   = weekBars.reduce((s, b) => s + b.value, 0);
  const weekOrders  = orders.filter(o => {
    const key = getShiftedDateKey(o.createdAt);
    return weekBars.some(b => b.date === key);
  }).length;

  const recentOrders = orders.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.username}>{username} 👋</Text>
        </View>
      </View>

      {/* Today stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: C.amber + '55' }]}>
          <Text style={[styles.statValue, { color: C.amber }]}>₱{todaySpent.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Spent Today</Text>
        </View>
        <View style={[styles.statCard, { borderColor: C.blue + '55' }]}>
          <Text style={[styles.statValue, { color: C.blue }]}>{todayCount}</Text>
          <Text style={styles.statLabel}>Orders Today</Text>
        </View>
        <View style={[styles.statCard, { borderColor: C.coral + '55' }]}>
          <Text style={[styles.statValue, { color: pendingCount > 0 ? C.coral : C.muted2 }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Weekly spending chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Weekly Spending</Text>
            <Text style={styles.cardSub}>Last 7 days · {weekOrders} orders</Text>
          </View>
          <View style={styles.weekTotalBadge}>
            <Text style={styles.weekTotalText}>₱{weekTotal.toFixed(0)}</Text>
          </View>
        </View>
        <BarChart bars={weekBars} />
      </View>

      {/* Recent orders */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Orders</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recentOrders.map(order => {
              const color = STATUS_COLOR[order.status];
              return (
                <View key={order.id} style={styles.recentRow}>
                  <View style={[styles.recentDot, { backgroundColor: color }]} />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName} numberOfLines={1}>{order.productName}</Text>
                    <Text style={styles.recentMeta}>
                      {order.quantity}× · {new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={[styles.recentAmount, order.paymentStatus === 'unpaid' && { color: C.coral }]}>
                      {order.paymentStatus === 'unpaid' ? '-' : ''}₱{Math.abs(order.total).toFixed(0)}
                    </Text>
                    <View style={[styles.recentBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                      <Text style={[styles.recentBadgeText, { color }]}>{STATUS_LABEL[order.status]}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 16, paddingTop: 60, paddingBottom: 120, gap: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.amber + '22',
    borderWidth: 2,
    borderColor: C.amber + '55',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: C.amber, fontFamily: F.extraBold, fontSize: 22 },
  greeting:   { color: C.muted2, fontSize: 13, fontFamily: F.medium },
  username:   { color: C.text,   fontSize: 20, fontFamily: F.extraBold, letterSpacing: -0.3 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: F.extraBold, letterSpacing: -0.5 },
  statLabel: { color: C.muted2, fontSize: 10.5, fontFamily: F.medium, textAlign: 'center' },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:  { color: C.text,   fontSize: 16, fontFamily: F.extraBold },
  cardSub:    { color: C.muted2, fontSize: 12, fontFamily: F.medium, marginTop: 2 },
  weekTotalBadge: {
    backgroundColor: C.amber + '1A',
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.amber + '55',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  weekTotalText: { color: C.amber, fontFamily: F.extraBold, fontSize: 14 },

  barChart:  { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 110 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue:  { fontSize: 9, fontFamily: F.bold, textAlign: 'center' },
  bar:       { width: '100%', borderRadius: 4 },
  barLabel:  { color: C.muted2, fontSize: 10, fontFamily: F.medium },

  emptyOrders: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyIcon:   { fontSize: 36 },
  emptyText:   { color: C.muted2, fontSize: 14, fontFamily: F.medium },

  recentList: { gap: 12 },
  recentRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentDot:  { width: 8, height: 8, borderRadius: 4 },
  recentInfo: { flex: 1 },
  recentName: { color: C.text, fontSize: 14, fontFamily: F.bold },
  recentMeta: { color: C.muted2, fontSize: 11, fontFamily: F.medium },
  recentRight:{ alignItems: 'flex-end', gap: 3 },
  recentAmount: { color: C.green, fontSize: 15, fontFamily: F.extraBold },
  recentBadge: { borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 6, paddingVertical: 2 },
  recentBadgeText: { fontSize: 9, fontFamily: F.bold },
});
