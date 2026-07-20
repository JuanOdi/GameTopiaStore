import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { subscribeToUserCashRequests } from '@/lib/gcash';
import { subscribeToUserOrders } from '@/lib/orders';
import { C, F } from '@/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'dashboard', label: 'Home',        icon: 'home-outline',       activeIcon: 'home'       },
  { name: 'index',     label: 'Store',       icon: 'storefront-outline', activeIcon: 'storefront' },
  { name: 'orders',    label: 'Orders',      icon: 'receipt-outline',    activeIcon: 'receipt'    },
  { name: 'gcash',     label: 'GCash/Print', icon: 'wallet-outline',     activeIcon: 'wallet'     },
  { name: 'profile',   label: 'Profile',     icon: 'person-outline',     activeIcon: 'person'     },
];

export default function UserLayout() {
  const { user } = useAuth();
  const [activeOrders, setActiveOrders] = useState(0);
  const [pendingCash, setPendingCash] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserOrders(user.uid, (orders) => {
      setActiveOrders(orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserCashRequests(user.uid, (requests) => {
      setPendingCash(requests.filter((r) => r.status === 'pending').length);
    });
    return () => unsub();
  }, [user]);

  const badges: Record<string, number> = {
    orders: activeOrders,
    gcash:  pendingCash,
  };

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View style={styles.tabBarWrapper}>
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
                          size={22}
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
    paddingHorizontal: 8,
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
});
