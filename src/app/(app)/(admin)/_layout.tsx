import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type CashRequest, subscribeToAllCashRequests, updateCashRequestStatus } from '@/lib/gcash';
import { type LoadRequest, subscribeToAllLoadRequests, updateLoadRequestStatus } from '@/lib/load';
import { sendAdminAlert } from '@/lib/notifications';
import { type Order, subscribeToOrders, updateOrderStatus } from '@/lib/orders';
import { type AddOn, type Product, subscribeToAllProducts } from '@/lib/products';
import { C, F } from '@/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type NotifItem = {
  title: string;
  message: string;
  icon: IoniconName;
  color: string;
  orderId?: string;
  requestId?: string;
  loadRequestId?: string;
  heading?: string;
  qty?: number;
  addOns?: AddOn[];
};

const TABS: { name: string; label: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'index',    label: 'Dashboard', icon: 'grid-outline',    activeIcon: 'grid'    },
  { name: 'products', label: 'Products',  icon: 'cube-outline',    activeIcon: 'cube'    },
  { name: 'orders',   label: 'Orders',    icon: 'receipt-outline', activeIcon: 'receipt' },
  { name: 'gcash',    label: 'GCash/Print', icon: 'wallet-outline',  activeIcon: 'wallet'  },
  { name: 'profile',  label: 'Profile',   icon: 'person-outline',  activeIcon: 'person'  },
];

function NotifModal({
  notif,
  onDismiss,
  onAccept,
  onReject,
  onApproveCash,
  onRejectCash,
  onApproveLoad,
  onRejectLoad,
}: {
  notif: NotifItem | null;
  onDismiss: () => void;
  onAccept?: (orderId: string) => void;
  onReject?: (orderId: string, reason: string) => void;
  onApproveCash?: (requestId: string) => void;
  onRejectCash?: (requestId: string) => void;
  onApproveLoad?: (loadRequestId: string) => void;
  onRejectLoad?: (loadRequestId: string) => void;
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [rejectStep, setRejectStep] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setRejectStep(false);
    setRejectReason('');
    if (!notif) return;
    slideAnim.setValue(60);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.85);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [notif]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Modal transparent visible={!!notif} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalCard,
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}>
          <View style={styles.iconOuter}>
            <Animated.View
              style={[
                styles.iconPulse,
                { backgroundColor: notif?.color + '22', transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: notif?.color + '22' }]}>
              <Ionicons name={notif?.icon ?? 'notifications'} size={30} color={notif?.color ?? C.amber} />
            </View>
          </View>
          <Text style={styles.modalTitle}>{notif?.title}</Text>
          <View style={styles.divider} />
          {notif?.heading ? (
            <View style={styles.modalHeadingRow}>
              <Text style={styles.modalHeading}>{notif.heading}</Text>
              {(notif.qty ?? 1) > 1 && (
                <View style={styles.modalHeadingQtyBadge}>
                  <Text style={styles.modalHeadingQtyText}>×{notif.qty}</Text>
                </View>
              )}
            </View>
          ) : null}
          {notif?.addOns && notif.addOns.length > 0 && (
            <View style={styles.modalAddOnsWrap}>
              {notif.addOns.map((a, i) => (
                <View key={i} style={styles.modalAddOnRow}>
                  <Text style={styles.modalAddOnName}>{a.name}</Text>
                  {(a.quantity ?? 1) > 1 && (
                    <View style={styles.modalAddOnQtyBadge}>
                      <Text style={styles.modalAddOnQtyText}>×{a.quantity}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          <Text style={styles.modalMessage}>{notif?.message}</Text>
          {notif?.orderId ? (
            rejectStep ? (
              <View style={styles.rejectStepWrap}>
                <Text style={styles.rejectStepLabel}>Reason for rejection (optional)</Text>
                <TextInput
                  style={styles.rejectInput}
                  placeholder="e.g. Out of stock, closed..."
                  placeholderTextColor={C.muted2}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  autoFocus
                  returnKeyType="done"
                />
                <View style={styles.orderActions}>
                  <Pressable
                    style={({ pressed }) => [styles.okBtn, styles.rejectBtn, { flex: 1 }, pressed && styles.okBtnPressed]}
                    onPress={() => { onReject?.(notif.orderId!, rejectReason.trim()); handleDismiss(); }}>
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={[styles.okText, { color: '#fff' }]}>Confirm Reject</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setRejectStep(false)}>
                  <Text style={styles.rejectBackText}>← Back</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.orderActions}>
                <Pressable
                  style={({ pressed }) => [styles.okBtn, styles.acceptBtn, pressed && styles.okBtnPressed]}
                  onPress={() => { onAccept?.(notif.orderId!); handleDismiss(); }}>
                  <Ionicons name="checkmark" size={18} color={C.bg} />
                  <Text style={styles.okText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.okBtn, styles.rejectBtn, pressed && styles.okBtnPressed]}
                  onPress={() => setRejectStep(true)}>
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={[styles.okText, { color: '#fff' }]}>Reject</Text>
                </Pressable>
              </View>
            )
          ) : notif?.requestId ? (
            <View style={styles.orderActions}>
              <Pressable
                style={({ pressed }) => [styles.okBtn, styles.cashApproveBtn, pressed && styles.okBtnPressed]}
                onPress={() => { onApproveCash?.(notif.requestId!); handleDismiss(); }}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={[styles.okText, { color: '#fff' }]}>Approve</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.okBtn, styles.cashRejectBtn, pressed && styles.okBtnPressed]}
                onPress={() => { onRejectCash?.(notif.requestId!); handleDismiss(); }}>
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={[styles.okText, { color: '#fff' }]}>Reject</Text>
              </Pressable>
            </View>
          ) : notif?.loadRequestId ? (
            <View style={styles.orderActions}>
              <Pressable
                style={({ pressed }) => [styles.okBtn, styles.cashApproveBtn, pressed && styles.okBtnPressed]}
                onPress={() => { onApproveLoad?.(notif.loadRequestId!); handleDismiss(); }}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={[styles.okText, { color: '#fff' }]}>Approve</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.okBtn, styles.cashRejectBtn, pressed && styles.okBtnPressed]}
                onPress={() => { onRejectLoad?.(notif.loadRequestId!); handleDismiss(); }}>
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={[styles.okText, { color: '#fff' }]}>Reject</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.okBtn, pressed && styles.okBtnPressed]}
              onPress={handleDismiss}>
              <Ionicons name="checkmark" size={18} color={C.bg} />
              <Text style={styles.okText}>Got it</Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function AdminLayout() {
  const prevOrders = useRef<Record<string, boolean>>({});
  const prevNotifiedAt = useRef<Record<string, number>>({});
  const initialized = useRef(false);
  const prevCashRequests = useRef<Record<string, boolean>>({});
  const prevCashNotifiedAt = useRef<Record<string, number>>({});
  const cashInitialized = useRef(false);
  const prevLoadRequests = useRef<Record<string, boolean>>({});
  const loadInitialized = useRef(false);
  const productsMap = useRef<Record<string, Product>>({});

  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingCash, setPendingCash] = useState(0);
  const [pendingLoad, setPendingLoad] = useState(0);

  const [notifQueue, setNotifQueue] = useState<NotifItem[]>([]);
  const currentNotif = notifQueue[0] ?? null;

  function pushNotif(item: NotifItem) {
    const headingLine = item.heading
      ? `${item.heading}${(item.qty ?? 1) > 1 ? ` ×${item.qty}` : ''}\n`
      : '';
    const addOnsLine = item.addOns && item.addOns.length > 0
      ? `\nAdd-ons: ${item.addOns.map((a) => ((a.quantity ?? 1) > 1 ? `${a.quantity}× ${a.name}` : a.name)).join(', ')}`
      : '';
    const fullMessage = `${headingLine}${item.message}${addOnsLine}`;
    if (Platform.OS === 'web') {
      window.alert(`${item.title}\n\n${fullMessage}`);
      return;
    }
    sendAdminAlert(item.title, fullMessage);
    setNotifQueue((q) => [...q, item]);
  }

  function dismissNotif() {
    setNotifQueue((q) => q.slice(1));
  }

  useEffect(() => {
    const unsubscribe = subscribeToAllProducts((products: Product[]) => {
      const map: Record<string, Product> = {};
      products.forEach((p) => { map[p.id] = p; });
      productsMap.current = map;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders((orders: Order[]) => {
      if (!initialized.current) {
        orders.forEach((order) => {
          prevOrders.current[order.id] = true;
          if (order.lastNotifiedAt) prevNotifiedAt.current[order.id] = order.lastNotifiedAt;
        });
        initialized.current = true;
      } else {
        orders.forEach((order) => {
          if (!prevOrders.current[order.id] && order.status === 'pending') {
            const product = productsMap.current[order.productId];
            if (product?.requiresConfirmation) {
              pushNotif({
                title: 'New Order',
                heading: order.productName,
                qty: order.quantity,
                message: `Total: ₱${order.total.toFixed(2)}\nFrom: ${order.userEmail}`,
                addOns: order.addOns,
                icon: 'receipt',
                color: '#3b82f6',
                orderId: order.id,
              });
            }
          }
          if (
            order.lastNotifiedAt &&
            order.lastNotifiedAt !== prevNotifiedAt.current[order.id]
          ) {
            pushNotif({
              title: '🔔 Customer Reminder',
              heading: order.productName,
              qty: order.quantity,
              message: `₱${order.total.toFixed(2)}\nFrom: ${order.userEmail}`,
              icon: 'notifications',
              color: '#f59e0b',
            });
            prevNotifiedAt.current[order.id] = order.lastNotifiedAt;
          }
          prevOrders.current[order.id] = true;
        });
      }
      setPendingOrders(orders.filter((o) => o.status === 'pending').length);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAllCashRequests((requests: CashRequest[]) => {
      if (!cashInitialized.current) {
        requests.forEach((r) => {
          prevCashRequests.current[r.id] = true;
          if (r.lastNotifiedAt) prevCashNotifiedAt.current[r.id] = r.lastNotifiedAt;
        });
        cashInitialized.current = true;
      } else {
        requests.forEach((r) => {
          if (!prevCashRequests.current[r.id] && r.status === 'pending') {
            const isCashIn = r.type === 'cash_in';
            const feeLine = r.withFee ? `+ ₱${(r.fee ?? 0).toFixed(2)} fee` : '';
            const earnLine = (r.fee ?? 0) > 0 ? `Earn: +₱${(r.fee ?? 0).toFixed(2)}` : '';
            pushNotif({
              title: isCashIn ? 'Cash In Request' : 'Cash Out Request',
              heading: `₱${r.amount.toFixed(2)}`,
              message: [feeLine, earnLine, `From: ${r.userEmail}`].filter(Boolean).join('\n'),
              icon: isCashIn ? 'arrow-down-circle' : 'arrow-up-circle',
              color: isCashIn ? '#22c55e' : C.coral,
              requestId: r.id,
            });
          }
          if (r.lastNotifiedAt && r.lastNotifiedAt !== prevCashNotifiedAt.current[r.id]) {
            const isCashIn = r.type === 'cash_in';
            const feeLine = r.withFee ? `+ ₱${(r.fee ?? 0).toFixed(2)} fee` : '';
            pushNotif({
              title: `🔔 ${isCashIn ? 'Cash In' : 'Cash Out'} Reminder`,
              heading: `₱${r.amount.toFixed(2)}`,
              message: [feeLine, `From: ${r.userEmail}`].filter(Boolean).join('\n'),
              icon: 'notifications',
              color: '#f59e0b',
            });
            prevCashNotifiedAt.current[r.id] = r.lastNotifiedAt;
          }
          prevCashRequests.current[r.id] = true;
        });
      }
      setPendingCash(requests.filter((r) => r.status === 'pending').length);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAllLoadRequests((requests: LoadRequest[]) => {
      if (!loadInitialized.current) {
        requests.forEach((r) => { prevLoadRequests.current[r.id] = true; });
        loadInitialized.current = true;
      } else {
        requests.forEach((r) => {
          if (!prevLoadRequests.current[r.id] && r.status === 'pending') {
            pushNotif({
              title: '📱 Load Request',
              message: `${r.network} · ${r.phone}\n₱${r.amount.toFixed(2)}${r.note ? `\nNote: ${r.note}` : ''}\nFrom: ${r.userEmail}`,
              icon: 'phone-portrait-outline',
              color: C.green,
              loadRequestId: r.id,
            });
          }
          prevLoadRequests.current[r.id] = true;
        });
      }
      setPendingLoad(requests.filter((r) => r.status === 'pending').length);
    });
    return () => unsubscribe();
  }, []);

  const badges: Record<string, number> = {
    orders: pendingOrders,
    gcash:  pendingCash + pendingLoad,
  };

  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state, navigation }) => (
          <View style={[styles.tabBarWrapper, { bottom: insets.bottom + 12 }]}>
            <View style={styles.tabBar}>
              {TABS.map((tab, index) => {
                const focused = state.index === index;
                const badgeCount = badges[tab.name] ?? 0;
                return (
                  <Pressable
                    key={tab.name}
                    style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
                    onPress={() => navigation.navigate(tab.name)}
                    android_ripple={{ color: C.amber + '33', borderless: true, radius: 32 }}>
                    <View style={styles.tabItemInner}>
                      <View style={styles.iconWrap}>
                        <View style={[styles.iconBg, focused && styles.iconBgActive]}>
                          <Ionicons
                            name={focused ? tab.activeIcon : tab.icon}
                            size={20}
                            color={focused ? C.bg : C.muted2}
                          />
                        </View>
                        {badgeCount > 0 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                        {tab.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}>
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} />
        ))}
      </Tabs>

      <NotifModal
        notif={currentNotif}
        onDismiss={dismissNotif}
        onAccept={(id) => updateOrderStatus(id, 'confirmed')}
        onReject={(id, reason) => updateOrderStatus(id, 'cancelled', reason)}
        onApproveCash={(id) => updateCashRequestStatus(id, 'approved')}
        onRejectCash={(id) => updateCashRequestStatus(id, 'rejected')}
        onApproveLoad={(id) => updateLoadRequestStatus(id, 'approved')}
        onRejectLoad={(id) => updateLoadRequestStatus(id, 'rejected')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  tabItemInner: {
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  iconBg: {
    width: 44,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBgActive: {
    backgroundColor: C.amber,
  },
  tabLabel: {
    color: C.muted2,
    fontSize: 10,
    fontFamily: F.bold,
  },
  tabLabelActive: {
    color: C.amber,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: C.coral,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.surface,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: F.bold,
  },

  /* ── Notif Modal ── */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
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
  iconOuter: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: F.extraBold,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: C.line,
    borderRadius: 2,
  },
  modalMessage: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalHeading: {
    color: C.amber,
    fontSize: 24,
    fontFamily: F.extraBold,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  modalHeadingQtyBadge: {
    backgroundColor: C.amber + '26',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  modalHeadingQtyText: { color: C.amber, fontSize: 14, fontFamily: F.extraBold },
  modalAddOnsWrap: {
    width: '100%',
    gap: 6,
  },
  modalAddOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalAddOnName: { color: C.text, fontSize: 13, fontFamily: F.medium },
  modalAddOnQtyBadge: {
    backgroundColor: C.amber + '26',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modalAddOnQtyText: { color: C.amber, fontSize: 12, fontFamily: F.bold },
  okBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  okBtnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  okText: {
    color: C.bg,
    fontSize: 16,
    fontFamily: F.bold,
    letterSpacing: 0.5,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: C.amber,
    flex: 1,
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: C.coral,
    flex: 1,
    justifyContent: 'center',
  },
  cashApproveBtn: {
    backgroundColor: C.green,
    shadowColor: C.green,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cashRejectBtn: {
    backgroundColor: C.coral,
    shadowColor: C.coral,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rejectStepWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  rejectStepLabel: {
    color: C.muted,
    fontSize: 13,
    fontFamily: F.medium,
    alignSelf: 'flex-start',
  },
  rejectInput: {
    width: '100%',
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontFamily: F.medium,
    fontSize: 14,
  },
  rejectBackText: {
    color: C.muted2,
    fontSize: 13,
    fontFamily: F.medium,
    marginTop: 2,
  },
});
