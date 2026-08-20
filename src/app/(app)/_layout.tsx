import { Ionicons } from '@expo/vector-icons';
import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useRole } from '@/hooks/use-role';
import { logOut } from '@/lib/auth';
import { type CashRequest, subscribeToUserCashRequests } from '@/lib/gcash';
import { setupNotifications } from '@/lib/notifications';
import { type Order, subscribeToUserOrders } from '@/lib/orders';
import { registerPresence, subscribeToForceLogout } from '@/lib/presence';
import { C, F } from '@/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type UserNotifItem = {
  title: string;
  message: string;
  icon: IoniconName;
  color: string;
};

const STATUS_CONFIG: Partial<Record<Order['status'], { title: string; body: string; icon: IoniconName; color: string }>> = {
  confirmed: {
    title: 'Order Confirmed!',
    body: 'The admin has confirmed your order.',
    icon: 'checkmark-circle',
    color: C.green,
  },
  cancelled: {
    title: 'Order Cancelled',
    body: 'The admin has cancelled your order.',
    icon: 'close-circle',
    color: C.coral,
  },
  completed: {
    title: 'Order Completed!',
    body: 'Your order is complete. Enjoy!',
    icon: 'star',
    color: C.amber,
  },
};

function UserNotifModal({
  notif,
  onDismiss,
}: {
  notif: UserNotifItem | null;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
                { backgroundColor: (notif?.color ?? C.amber) + '22', transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: (notif?.color ?? C.amber) + '22' }]}>
              <Ionicons name={notif?.icon ?? 'notifications'} size={30} color={notif?.color ?? C.amber} />
            </View>
          </View>

          <Text style={styles.modalTitle}>{notif?.title}</Text>
          <View style={styles.divider} />
          <Text style={styles.modalMessage}>{notif?.message}</Text>

          <Pressable
            style={({ pressed }) => [styles.okBtn, { backgroundColor: notif?.color ?? C.amber }, pressed && styles.okBtnPressed]}
            onPress={handleDismiss}>
            <Ionicons name="checkmark" size={18} color={C.bg} />
            <Text style={styles.okText}>Got it</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const { role, loading } = useRole(user?.uid);
  const router = useRouter();
  const segments = useSegments();
  const prevStatuses = useRef<Record<string, Order['status']>>({});
  const initialized = useRef(false);
  const prevCashStatuses = useRef<Record<string, CashRequest['status']>>({});
  const cashInitialized = useRef(false);

  const [notifQueue, setNotifQueue] = useState<UserNotifItem[]>([]);
  const currentNotif = notifQueue[0] ?? null;

  function pushNotif(item: UserNotifItem) {
    setNotifQueue((q) => [...q, item]);
  }

  function dismissNotif() {
    setNotifQueue((q) => q.slice(1));
  }

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAdmin = segments[1] === '(admin)';
    const inUser = segments[1] === '(user)';

    if (role === 'admin' && !inAdmin) {
      router.replace('/(app)/(admin)');
    } else if (role !== 'admin' && !inUser) {
      router.replace('/(app)/(user)');
    }
  }, [role, loading, segments]);

  // Presence + admin remote-logout (users only; admins never appear in the online list)
  useEffect(() => {
    if (!user || role !== 'user') return;
    const cleanupPresence = registerPresence(user.uid, user.email ?? '');
    const unsubKick = subscribeToForceLogout(user.uid, () => {
      cleanupPresence();
      logOut();
    });
    return () => {
      unsubKick();
      cleanupPresence();
    };
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== 'user') return;

    const unsubscribe = subscribeToUserOrders(user.uid, (orders) => {
      if (!initialized.current) {
        orders.forEach((o) => { prevStatuses.current[o.id] = o.status; });
        initialized.current = true;
        return;
      }

      orders.forEach((order) => {
        const prev = prevStatuses.current[order.id];
        if (prev && prev !== order.status) {
          const config = STATUS_CONFIG[order.status];
          if (config) {
            const reasonLine = order.status === 'cancelled' && order.cancelReason
              ? `\nReason: ${order.cancelReason}`
              : '';
            pushNotif({
              title: config.title,
              message: `${order.productName}${reasonLine}\n\n${config.body}`,
              icon: config.icon,
              color: config.color,
            });
          }
        }
        prevStatuses.current[order.id] = order.status;
      });
    });

    return () => unsubscribe();
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== 'user') return;

    const unsubscribe = subscribeToUserCashRequests(user.uid, (requests) => {
      if (!cashInitialized.current) {
        requests.forEach((r) => { prevCashStatuses.current[r.id] = r.status; });
        cashInitialized.current = true;
        return;
      }

      requests.forEach((req) => {
        const prev = prevCashStatuses.current[req.id];
        if (prev === 'pending' && req.status !== 'pending') {
          const typeLabel = req.type === 'cash_in' ? 'Cash In' : 'Cash Out';
          const approved = req.status === 'approved';
          pushNotif({
            title: approved ? 'GCash Request Approved!' : 'GCash Request Rejected',
            message: approved
              ? `Your ₱${req.amount.toFixed(2)} ${typeLabel} request has been approved.`
              : `Your ₱${req.amount.toFixed(2)} ${typeLabel} request was rejected.`,
            icon: approved ? 'checkmark-circle' : 'close-circle',
            color: approved ? C.green : C.coral,
          });
        }
        prevCashStatuses.current[req.id] = req.status;
      });
    });

    return () => unsubscribe();
  }, [user, role]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <UserNotifModal notif={currentNotif} onDismiss={dismissNotif} />
    </>
  );
}

const styles = StyleSheet.create({
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
  okBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
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
});
