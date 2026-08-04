import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { type Order, markOrderPaid, notifyAdmin, subscribeToUserOrders } from '@/lib/orders';
import { C, F, R } from '@/lib/theme';

const STATUS_CONFIG: Record<Order['status'], { color: string; label: string; message: string }> = {
  pending:   { color: C.amber, label: 'PENDING',   message: 'Waiting for admin confirmation.' },
  confirmed: { color: C.blue,  label: 'CONFIRMED', message: 'Your order has been confirmed!'  },
  completed: { color: C.green, label: 'COMPLETED', message: 'Your order is complete. Enjoy!'  },
  cancelled: { color: C.coral, label: 'CANCELLED', message: 'Your order was cancelled.'       },
};

type Filter = 'all' | 'pending' | 'completed';

const COOLDOWN_MS = 60 * 1000;

export default function UserOrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserOrders(user.uid, setOrders);
    return () => unsubscribe();
  }, [user]);

  // Tick every second while any pending order is in notify cooldown, so the countdown updates
  useEffect(() => {
    const hasActiveCooldown = orders.some(
      (o) => o.status === 'pending' && o.lastNotifiedAt && Date.now() - o.lastNotifiedAt < COOLDOWN_MS
    );
    if (!hasActiveCooldown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [orders, now]);

  async function handleNotify(order: Order) {
    if (Date.now() - (order.lastNotifiedAt ?? 0) < COOLDOWN_MS) return;
    try {
      await notifyAdmin(order.id);
      setNow(Date.now());
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message);
      else Alert.alert('Error', e.message);
    }
  }

  const [paidConfirm, setPaidConfirm] = useState<{ order: Order; method: 'cash' | 'gcash' } | null>(null);
  const [savingPaid, setSavingPaid] = useState(false);

  async function confirmPaid() {
    if (!paidConfirm || savingPaid) return;
    setSavingPaid(true);
    try {
      await markOrderPaid(paidConfirm.order.id, paidConfirm.method);
      setPaidConfirm(null);
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e.message);
      else Alert.alert('Error', e.message);
    } finally {
      setSavingPaid(false);
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders    = orders.filter((o) => o.createdAt >= todayStart.getTime());
  const todayTotal     = todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const todayCompleted = todayOrders.filter((o) => o.status === 'completed' || o.status === 'confirmed').length;
  const todayPending   = todayOrders.filter((o) => o.status === 'pending').length;

  const pendingCount   = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'completed' || o.status === 'confirmed').length;

  const displayed = filter === 'all'
    ? orders
    : orders.filter((o) =>
        filter === 'completed'
          ? o.status === 'completed' || o.status === 'confirmed'
          : o.status === filter
      );

  type ListItem = { type: 'header'; label: string; key: string } | { type: 'order'; order: Order; key: string };

  function buildGrouped(list: Order[]): ListItem[] {
    const result: ListItem[] = [];
    let lastKey = '';
    for (const order of list) {
      const pht = new Date(order.createdAt + 8 * 60 * 60 * 1000);
      const dateKey = pht.toISOString().slice(0, 10);
      if (dateKey !== lastKey) {
        const todayKey = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const yestKey  = new Date(Date.now() + 8 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
        const label = dateKey === todayKey ? 'Today'
          : dateKey === yestKey ? 'Yesterday'
          : pht.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
        result.push({ type: 'header', label, key: `h-${dateKey}` });
        lastKey = dateKey;
      }
      result.push({ type: 'order', order, key: order.id });
    }
    return result;
  }

  const groupedList = buildGrouped(displayed);

  const TABS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending',   count: pendingCount   },
    { key: 'completed', label: 'Completed', count: completedCount },
  ];

  if (orders.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptySubtitle}>Your orders will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>My Orders</Text>
          <Text style={styles.headerSub}>Track your order history</Text>
        </View>
      </View>

      {/* Today's Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>TODAY</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{todayOrders.length}</Text>
            <Text style={styles.summaryLabel}>Orders</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.green }]}>{todayCompleted}</Text>
            <Text style={styles.summaryLabel}>Done</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.amber }]}>{todayPending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.green }]}>₱{todayTotal.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Spent</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
              onPress={() => setFilter(tab.key)}>
              <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View style={styles.countBubble}>
                  <Text style={styles.countBubbleText}>{tab.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Orders list */}
      {displayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No {filter} orders</Text>
        </View>
      ) : (
        <FlatList
          data={groupedList}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.dateHeader}>{item.label}</Text>;
            }
            const { order } = item;
            const sc      = STATUS_CONFIG[order.status];
            const avatarBg     = sc.color + '26';
            const avatarBorder = sc.color + '59';
            const initial = order.productName.charAt(0).toUpperCase();

            return (
              <View style={styles.card}>
                {/* Left: avatar */}
                <View style={[styles.avatar, { backgroundColor: avatarBg, borderColor: avatarBorder }]}>
                  <Text style={[styles.avatarText, { color: sc.color }]}>{initial}</Text>
                </View>

                {/* Center */}
                <View style={styles.cardCenter}>
                  <View style={styles.nameRow}>
                    <Text style={styles.productName} numberOfLines={1}>{order.productName}</Text>
                    {order.isCustom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>CUSTOM</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.metaText}>
                    {order.quantity}× · {new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </Text>

                  <Text style={styles.messageText}>{sc.message}</Text>

                  <View style={styles.badgeRow}>
                    <View style={[styles.statusPill, { backgroundColor: sc.color + '26', borderColor: sc.color + '59' }]}>
                      <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                    {order.paymentStatus === 'unpaid' && (
                      <View style={styles.unpaidPill}>
                        <Text style={styles.unpaidPillText}>UNPAID</Text>
                      </View>
                    )}
                    {order.paymentStatus === 'cash' && (
                      <View style={[styles.paymentPill, { backgroundColor: C.amber + '1A', borderColor: C.amber + '55' }]}>
                        <Text style={[styles.paymentPillText, { color: C.amber }]}>💵 Cash</Text>
                      </View>
                    )}
                    {order.paymentStatus === 'gcash' && (
                      <View style={[styles.paymentPill, { backgroundColor: C.blue + '1A', borderColor: C.blue + '55' }]}>
                        <Text style={[styles.paymentPillText, { color: C.blue }]}>📱 GCash</Text>
                      </View>
                    )}
                  </View>
                  {order.paymentStatus === 'unpaid' && order.unpaidReason ? (
                    <Text style={styles.unpaidReason}>Reason: {order.unpaidReason}</Text>
                  ) : null}

                  {order.status === 'pending' && (() => {
                    const remainingMs = COOLDOWN_MS - (now - (order.lastNotifiedAt ?? 0));
                    const coolingDown = !!order.lastNotifiedAt && remainingMs > 0;
                    return (
                      <Pressable
                        disabled={coolingDown}
                        style={({ pressed }) => [
                          styles.notifyBtn,
                          coolingDown && styles.notifyBtnDisabled,
                          pressed && !coolingDown && { transform: [{ scale: 0.97 }] },
                        ]}
                        onPress={() => handleNotify(order)}>
                        <Text style={[styles.notifyText, coolingDown && styles.notifyTextDisabled]}>
                          {coolingDown
                            ? `🔔 Notified · wait ${Math.ceil(remainingMs / 1000)}s`
                            : '🔔 Notify Admin'}
                        </Text>
                      </Pressable>
                    );
                  })()}

                  {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && (
                    <View style={styles.paidRow}>
                      <Pressable
                        style={({ pressed }) => [styles.paidBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                        onPress={() => setPaidConfirm({ order, method: 'cash' })}>
                        <Text style={styles.paidText}>💵 Paid · Cash</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.paidBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                        onPress={() => setPaidConfirm({ order, method: 'gcash' })}>
                        <Text style={styles.paidText}>📱 Paid · GCash</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Right */}
                <View style={styles.cardRight}>
                  <Text style={[styles.totalText, order.paymentStatus === 'unpaid' && { color: C.coral }]}>
                    {order.paymentStatus === 'unpaid' ? '-' : ''}₱{Math.abs(order.total).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Mark as Paid confirmation modal */}
      <Modal
        transparent
        visible={paidConfirm !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !savingPaid && setPaidConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Text style={styles.modalIcon}>{paidConfirm?.method === 'gcash' ? '📱' : '💵'}</Text>
            </View>
            <Text style={styles.modalTitle}>Mark as Paid</Text>
            <View style={styles.modalDivider} />
            <Text style={styles.modalMessage}>
              Mark <Text style={styles.modalHighlight}>{paidConfirm?.order.productName}</Text> (₱
              {paidConfirm ? Math.abs(paidConfirm.order.total).toFixed(2) : ''}) as paid with{' '}
              <Text style={styles.modalHighlight}>{paidConfirm?.method === 'gcash' ? 'GCash' : 'Cash'}</Text>?
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable
                disabled={savingPaid}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && styles.modalBtnPressed]}
                onPress={() => setPaidConfirm(null)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={savingPaid}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnConfirm, pressed && styles.modalBtnPressed]}
                onPress={confirmPaid}>
                <Text style={styles.modalBtnConfirmText}>{savingPaid ? 'Saving…' : '✓ Yes, Paid'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  dateHeader: {
    color: C.text,
    fontSize: 15,
    fontFamily: F.extraBold,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },

  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  header:    { color: C.text, fontSize: 28, fontFamily: F.extraBold, letterSpacing: -0.5 },
  headerSub: { color: C.muted2, fontSize: 11, fontFamily: F.medium, marginTop: 2 },

  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  summaryTitle: { color: C.muted2, fontSize: 10.5, fontFamily: F.bold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue:   { color: C.text, fontSize: 20, fontFamily: F.extraBold, letterSpacing: -0.4 },
  summaryLabel:   { color: C.muted2, fontSize: 10.5, fontFamily: F.medium },
  summaryDivider: { width: 1, height: 32, backgroundColor: C.line },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.chip },
  tabActive:        { backgroundColor: C.amber },
  tabInactive:      { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  tabText:          { fontFamily: F.bold, fontSize: 13 },
  tabTextActive:    { color: '#0f0e0d' },
  tabTextInactive:  { color: C.muted },
  countBubble:      { backgroundColor: C.coral, borderRadius: 999, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  countBubbleText:  { color: '#fff', fontFamily: F.bold, fontSize: 9 },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyText: { color: C.muted2, fontSize: 14, fontFamily: F.medium },

  list: { paddingHorizontal: 20, paddingBottom: 120, gap: 10 },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },

  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: F.extraBold },

  cardCenter: { flex: 1 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  productName: { color: C.text, fontSize: 16, fontFamily: F.extraBold, flex: 1 },
  customBadge: { backgroundColor: C.blue + '1A', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  customBadgeText: { color: C.blue, fontFamily: F.bold, fontSize: 10 },
  metaText:    { color: C.muted2, fontSize: 12.5, fontFamily: F.medium, marginBottom: 2 },
  messageText: { color: C.muted, fontSize: 12, fontFamily: F.medium, marginBottom: 4 },
  statusPill: { borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontFamily: F.bold, fontSize: 10.5, textTransform: 'uppercase' },

  notifyBtn: {
    marginTop: 8,
    backgroundColor: C.amber + '1A',
    borderWidth: 1,
    borderColor: C.amber + '59',
    borderRadius: R.btn,
    paddingVertical: 9,
    alignItems: 'center',
  },
  notifyText: { color: C.amber, fontFamily: F.bold, fontSize: 13 },
  notifyBtnDisabled: { backgroundColor: C.surface2, borderColor: C.line, opacity: 0.7 },
  notifyTextDisabled: { color: C.muted2 },

  paidRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  paidBtn: {
    flex: 1,
    backgroundColor: C.green + '1A',
    borderWidth: 1,
    borderColor: C.green + '59',
    borderRadius: R.btn,
    paddingVertical: 9,
    alignItems: 'center',
  },
  paidText: { color: C.green, fontFamily: F.bold, fontSize: 13 },

  cardRight: { alignItems: 'flex-end' },
  totalText: { color: C.green, fontFamily: F.extraBold, fontSize: 19, letterSpacing: -0.4 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  unpaidPill: {
    backgroundColor: C.coral + '26',
    borderWidth: 1,
    borderColor: C.coral + '59',
    borderRadius: R.chip,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unpaidPillText: { color: C.coral, fontFamily: F.bold, fontSize: 10.5, textTransform: 'uppercase' },
  unpaidReason:   { color: C.muted, fontFamily: F.medium, fontSize: 12, marginTop: 2 },
  paymentPill:    { borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 8, paddingVertical: 3 },
  paymentPillText:{ fontFamily: F.bold, fontSize: 10.5 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: C.surface,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
    gap: 16,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.green + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalIcon:      { fontSize: 28 },
  modalTitle:     { color: C.text, fontSize: 20, fontFamily: F.extraBold, textAlign: 'center', letterSpacing: 0.3 },
  modalDivider:   { width: 40, height: 2, backgroundColor: C.line, borderRadius: 2 },
  modalMessage:   { color: C.muted, fontSize: 14, fontFamily: F.medium, textAlign: 'center', lineHeight: 22 },
  modalHighlight: { color: C.text, fontFamily: F.bold },
  modalBtnRow:    { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  modalBtn:       { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  modalBtnConfirm: {
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBtnPressed:     { opacity: 0.8, transform: [{ scale: 0.97 }] },
  modalBtnCancelText:  { color: C.muted, fontSize: 15, fontFamily: F.bold },
  modalBtnConfirmText: { color: C.bg, fontSize: 15, fontFamily: F.bold, letterSpacing: 0.3 },

  emptyScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: C.bg },
  emptyIcon:     { fontSize: 52 },
  emptyTitle:    { color: C.text, fontSize: 20, fontFamily: F.extraBold },
  emptySubtitle: { color: C.muted2, fontSize: 14, fontFamily: F.medium },
});
