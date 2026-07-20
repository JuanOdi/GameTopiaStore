import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/hooks/use-auth";
import {
  type CashRequest,
  type PrintRecord,
  computeFee,
  createCashRequest,
  createPrintRecord,
  notifyAdminCash,
  subscribeToUserCashRequests,
  subscribeToUserPrintRecords,
} from "@/lib/gcash";
import { type LoadRequest, createLoadRequest, subscribeToUserLoadRequests } from "@/lib/load";
import { C, F, R } from "@/lib/theme";

const STATUS_CONFIG: Record<
  CashRequest["status"],
  { color: string; bg: string; border: string; label: string; stripe: string }
> = {
  pending:  { color: C.amber, bg: C.amber + "26", border: C.amber + "59", stripe: C.amber, label: "PENDING" },
  approved: { color: C.green, bg: C.green + "26", border: C.green + "59", stripe: C.green, label: "APPROVED" },
  rejected: { color: C.coral, bg: C.coral + "26", border: C.coral + "59", stripe: C.coral, label: "REJECTED" },
};

const PRINT_TYPES = ["Colored", "Black & White", "Mixed"] as const;
type PrintType = (typeof PRINT_TYPES)[number];

const NETWORKS = ["Globe", "Smart", "TM", "TNT", "DITO"] as const;
type Network = (typeof NETWORKS)[number];

type Tab = "gcash" | "print" | "load";
type IoniconName = keyof typeof Ionicons.glyphMap;

type ModalConfig = {
  title: string;
  message: string;
  icon: IoniconName;
  color: string;
  confirmLabel?: string;
  onConfirm?: () => void;
};

function GCashInfoModal({ config, onDismiss }: { config: ModalConfig | null; onDismiss: () => void }) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!config) return;
    slideAnim.setValue(60); fadeAnim.setValue(0); scaleAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [config]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Modal transparent visible={!!config} animationType="none" statusBarTranslucent>
      <Animated.View style={[mStyles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[mStyles.card, { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
          <View style={mStyles.iconOuter}>
            <View style={[mStyles.iconCircle, { backgroundColor: (config?.color ?? C.amber) + "22" }]}>
              <Ionicons name={config?.icon ?? "notifications"} size={30} color={config?.color ?? C.amber} />
            </View>
          </View>
          <Text style={mStyles.title}>{config?.title}</Text>
          <View style={mStyles.divider} />
          <Text style={mStyles.message}>{config?.message}</Text>
          {config?.onConfirm ? (
            <View style={mStyles.btnRow}>
              <Pressable style={({ pressed }) => [mStyles.btn, mStyles.cancelBtn, pressed && mStyles.btnPressed]} onPress={handleDismiss}>
                <Text style={mStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [mStyles.btn, { backgroundColor: config.color, flex: 1 }, pressed && mStyles.btnPressed]}
                onPress={() => { config.onConfirm!(); handleDismiss(); }}
              >
                <Text style={mStyles.btnText}>{config.confirmLabel ?? "Confirm"}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [mStyles.btn, { backgroundColor: config?.color ?? C.amber }, pressed && mStyles.btnPressed]}
              onPress={handleDismiss}
            >
              <Ionicons name="checkmark" size={18} color="#0f0e0d" />
              <Text style={mStyles.btnText}>Got it</Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  card: { width: "100%", backgroundColor: C.surface, borderRadius: 24, paddingVertical: 32, paddingHorizontal: 28, alignItems: "center", borderWidth: 1, borderColor: C.line, shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 20, gap: 16 },
  iconOuter: { width: 80, height: 80, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  title: { color: C.text, fontSize: 20, fontFamily: F.extraBold, textAlign: "center", letterSpacing: 0.3 },
  divider: { width: 40, height: 2, backgroundColor: C.line, borderRadius: 2 },
  message: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  btnText: { color: "#0f0e0d", fontSize: 15, fontFamily: F.bold, letterSpacing: 0.4 },
  cancelBtn: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  cancelBtnText: { color: C.muted, fontSize: 15, fontFamily: F.bold },
});

export default function GCashScreen() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("gcash");

  // GCash state
  const [requests, setRequests]   = useState<CashRequest[]>([]);
  const [cashType, setCashType]   = useState<"cash_in" | "cash_out">("cash_in");
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [withFee, setWithFee]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Print state
  const [printRecords, setPrintRecords]   = useState<PrintRecord[]>([]);
  const [printType, setPrintType]         = useState<PrintType>("Colored");
  const [printAmount, setPrintAmount]     = useState("");
  const [printWithGcash, setPrintWithGcash] = useState(false);
  const [printGcashRef, setPrintGcashRef] = useState("");
  const [printNote, setPrintNote]         = useState("");
  const [printLoading, setPrintLoading]   = useState(false);
  const [printSubmitted, setPrintSubmitted] = useState(false);

  // Load state
  const [loadRequests, setLoadRequests]   = useState<LoadRequest[]>([]);
  const [loadNetwork, setLoadNetwork]     = useState<Network>("Globe");
  const [loadPhone, setLoadPhone]         = useState("");
  const [loadAmount, setLoadAmount]       = useState("");
  const [loadNote, setLoadNote]           = useState("");
  const [loadLoading, setLoadLoading]     = useState(false);

  const [modal, setModal] = useState<ModalConfig | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserCashRequests(user.uid, setRequests);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserPrintRecords(user.uid, setPrintRecords);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserLoadRequests(user.uid, setLoadRequests);
  }, [user]);

  const COOLDOWN_MS = 60 * 1000;

  function showModal(config: ModalConfig) { setModal(config); }

  async function handleNotifyCash(request: CashRequest) {
    const lastSent  = cooldowns[request.id] ?? 0;
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    if (Date.now() - lastSent < COOLDOWN_MS) {
      showModal({ title: "Please Wait", message: `You can notify again in ${remaining} seconds.`, icon: "time-outline", color: C.amber });
      return;
    }
    try {
      await notifyAdminCash(request.id);
      setCooldowns((prev) => ({ ...prev, [request.id]: Date.now() }));
      showModal({ title: "Notified!", message: "The admin has been notified about your request.", icon: "notifications", color: C.green });
    } catch (e: any) {
      showModal({ title: "Error", message: e.message, icon: "alert-circle", color: C.coral });
    }
  }

  async function handleSubmit() {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      showModal({ title: "Invalid Amount", message: "Please enter a valid amount.", icon: "alert-circle", color: C.coral });
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      await createCashRequest(user.uid, user.email ?? "", cashType, parsed, withFee, note);
      setAmount(""); setNote(""); setWithFee(false);
      showModal({ title: "Request Submitted", message: "Your request has been sent to the admin.", icon: "checkmark-circle", color: C.green });
    } catch (e: any) {
      showModal({ title: "Error", message: e.message, icon: "alert-circle", color: C.coral });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintSubmit() {
    const parsed = parseFloat(printAmount);
    if (!parsed || parsed <= 0) {
      showModal({ title: "Invalid Amount", message: "Please enter a valid amount.", icon: "alert-circle", color: C.coral });
      return;
    }
    if (!user) return;
    setPrintLoading(true);
    try {
      await createPrintRecord(user.uid, user.email ?? "", printType, parsed, printWithGcash, printGcashRef, printNote);
      setPrintAmount(""); setPrintGcashRef(""); setPrintNote(""); setPrintWithGcash(true); setPrintType("Colored");
      setPrintSubmitted(true);
      setTimeout(() => setPrintSubmitted(false), 3000);
    } catch (e: any) {
      showModal({ title: "Error", message: e.message, icon: "alert-circle", color: C.coral });
    } finally {
      setPrintLoading(false);
    }
  }

  async function handleLoadSubmit() {
    const parsed = parseFloat(loadAmount);
    if (!parsed || parsed <= 0) {
      showModal({ title: "Invalid Amount", message: "Please enter a valid amount.", icon: "alert-circle", color: C.coral });
      return;
    }
    if (!loadPhone.trim()) {
      showModal({ title: "Phone Required", message: "Please enter a phone number.", icon: "alert-circle", color: C.coral });
      return;
    }
    if (!user) return;
    setLoadLoading(true);
    try {
      await createLoadRequest(user.uid, user.email ?? "", loadNetwork, loadPhone.trim(), parsed, loadNote);
      setLoadPhone(""); setLoadAmount(""); setLoadNote("");
      showModal({ title: "Request Submitted", message: "Your load request has been sent to the admin.", icon: "checkmark-circle", color: C.green });
    } catch (e: any) {
      showModal({ title: "Error", message: e.message, icon: "alert-circle", color: C.coral });
    } finally {
      setLoadLoading(false);
    }
  }

  const parsedAmount = parseFloat(amount) || 0;
  const feeAmount    = computeFee(parsedAmount);
  const netAmount    = withFee ? parsedAmount : parsedAmount - feeAmount;
  const grossAmount  = withFee ? parsedAmount + feeAmount : parsedAmount;

  const pendingGCash = requests.filter((r) => r.status === "pending").length;
  const pendingLoad  = loadRequests.filter((r) => r.status === "pending").length;

  const activeData: any[] =
    activeTab === "print" ? printRecords :
    activeTab === "load"  ? loadRequests :
    requests;

  const listHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>GCash & Print</Text>
        <Text style={styles.subtitle}>GCash · Print · Load</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { key: "gcash",  label: "GCash",     badge: pendingGCash },
          { key: "print",  label: "🖨️ Print",  badge: 0 },
          { key: "load",   label: "📱 Load",   badge: pendingLoad },
        ] as { key: Tab; label: string; badge: number }[]).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge > 9 ? "9+" : tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── PRINT FORM ── */}
      {activeTab === "print" ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Print Request</Text>
          {printSubmitted && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✅ Submitted to admin!</Text>
            </View>
          )}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Print Type</Text>
            <View style={styles.radioRow}>
              {PRINT_TYPES.map((type) => (
                <Pressable key={type} style={styles.radioOption} onPress={() => setPrintType(type)}>
                  <View style={[styles.radioCircle, printType === type && styles.radioCircleActive]}>
                    {printType === type && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>{type}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>₱</Text>
              <TextInput style={styles.amountInput} placeholder="0.00" placeholderTextColor={C.muted2} value={printAmount} onChangeText={setPrintAmount} keyboardType="decimal-pad" />
            </View>
          </View>
          <Pressable style={styles.gcashToggleRow} onPress={() => setPrintWithGcash((v) => !v)}>
            <Text style={styles.gcashToggleLabel}>GCash Payment</Text>
            <Switch value={printWithGcash} onValueChange={setPrintWithGcash} trackColor={{ false: C.surface3, true: C.green + "55" }} thumbColor={printWithGcash ? C.green : C.muted2} />
          </Pressable>
          {printWithGcash && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>GCash Reference # (optional)</Text>
              <TextInput style={styles.noteInput} placeholder="e.g. 1234567890" placeholderTextColor={C.muted2} value={printGcashRef} onChangeText={setPrintGcashRef} keyboardType="number-pad" />
            </View>
          )}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={styles.noteInput} placeholder="e.g. A4, 10 pages..." placeholderTextColor={C.muted2} value={printNote} onChangeText={setPrintNote} />
          </View>
          <Pressable style={({ pressed }) => [styles.submitBtn, styles.submitBtnPrint, pressed && styles.pressed, printLoading && { opacity: 0.6 }]} onPress={handlePrintSubmit} disabled={printLoading}>
            <Text style={[styles.submitText, { color: "#fff" }]}>{printLoading ? "Submitting..." : "📋 Submit to Admin"}</Text>
          </Pressable>
        </View>

      ) : activeTab === "load" ? (
        /* ── LOAD FORM ── */
        <View style={styles.form}>
          <Text style={styles.formTitle}>Request Load</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Network</Text>
            <View style={[styles.radioRow, { flexWrap: "wrap" }]}>
              {NETWORKS.map((n) => (
                <Pressable key={n} style={styles.radioOption} onPress={() => setLoadNetwork(n)}>
                  <View style={[styles.radioCircle, loadNetwork === n && styles.radioCircleActive]}>
                    {loadNetwork === n && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput style={styles.noteInput} placeholder="09XX XXX XXXX" placeholderTextColor={C.muted2} value={loadPhone} onChangeText={setLoadPhone} keyboardType="phone-pad" />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>₱</Text>
              <TextInput style={styles.amountInput} placeholder="0.00" placeholderTextColor={C.muted2} value={loadAmount} onChangeText={setLoadAmount} keyboardType="decimal-pad" />
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={styles.noteInput} placeholder="e.g. GoSURF50, promo..." placeholderTextColor={C.muted2} value={loadNote} onChangeText={setLoadNote} />
          </View>
          <Pressable style={({ pressed }) => [styles.submitBtn, styles.submitBtnLoad, pressed && styles.pressed, loadLoading && { opacity: 0.6 }]} onPress={handleLoadSubmit} disabled={loadLoading}>
            <Text style={[styles.submitText, { color: "#fff" }]}>{loadLoading ? "Submitting..." : "📱 Request Load"}</Text>
          </Pressable>
        </View>

      ) : (
        /* ── GCASH FORM ── */
        <View style={styles.form}>
          <Text style={styles.formTitle}>GCash Request</Text>

          {/* Type: Cash In / Cash Out */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.radioRow}>
              <Pressable style={styles.radioOption} onPress={() => setCashType("cash_in")}>
                <View style={[styles.radioCircle, cashType === "cash_in" && styles.radioCircleActive]}>
                  {cashType === "cash_in" && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>Cash In</Text>
              </Pressable>
              <Pressable style={styles.radioOption} onPress={() => setCashType("cash_out")}>
                <View style={[styles.radioCircle, cashType === "cash_out" && styles.radioCircleActive]}>
                  {cashType === "cash_out" && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>Cash Out</Text>
              </Pressable>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>₱</Text>
              <TextInput style={styles.amountInput} placeholder="0.00" placeholderTextColor={C.muted2} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </View>
          </View>

          {/* Fee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Fee</Text>
            <View style={styles.radioRow}>
              <Pressable style={styles.radioOption} onPress={() => setWithFee(false)}>
                <View style={[styles.radioCircle, !withFee && styles.radioCircleActive]}>
                  {!withFee && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>No Fee</Text>
              </Pressable>
              <Pressable style={styles.radioOption} onPress={() => setWithFee(true)}>
                <View style={[styles.radioCircle, withFee && styles.radioCircleActive]}>
                  {withFee && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>With Fee</Text>
              </Pressable>
            </View>
          </View>

          {parsedAmount > 0 && feeAmount > 0 && (
            <View style={styles.feeBox}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Amount</Text>
                <Text style={styles.feeValue}>₱{parsedAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>{withFee ? "Service Fee" : "Fee Deducted"}</Text>
                <Text style={styles.feeValueFee}>{withFee ? "+" : "-"}₱{feeAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.feeDivider} />
              <View style={styles.feeRow}>
                <Text style={styles.feeTotalLabel}>{withFee ? "Total You Pay" : "Net Amount"}</Text>
                <Text style={styles.feeTotalValue}>₱{(withFee ? grossAmount : netAmount).toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={styles.noteInput} placeholder="e.g. GCash reference number, account name..." placeholderTextColor={C.muted2} value={note} onChangeText={setNote} multiline numberOfLines={3} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, cashType === "cash_out" && styles.submitBtnOut, pressed && styles.pressed]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[styles.submitText, cashType === "cash_out" && styles.submitTextOut]}>
              {loading ? "Submitting..." : cashType === "cash_in" ? "↓ Request Cash In" : "↑ Request Cash Out"}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.historyRow}>
        <Text style={styles.historyTitle}>History</Text>
      </View>
      {activeData.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>
            {activeTab === "print" ? "🖨️" : activeTab === "load" ? "📱" : "💳"}
          </Text>
          <Text style={styles.emptyText}>
            No {activeTab === "print" ? "print" : activeTab === "load" ? "load" : "GCash"} records yet
          </Text>
        </View>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        style={styles.container}
        data={activeData}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }: { item: any }) => {
          if (activeTab === "print") {
            const r = item as PrintRecord;
            return (
              <View style={[styles.card, { borderLeftColor: r.withGcash ? C.green : C.blue }]}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardAmount}>₱{r.amount.toFixed(2)}</Text>
                  <View style={[styles.badge, { backgroundColor: C.blue + "1A", borderColor: C.blue + "55" }]}>
                    <Text style={[styles.badgeText, { color: C.blue }]}>{r.customerName}</Text>
                  </View>
                </View>
                {r.withGcash && (
                  <Text style={[styles.cardNote, { color: C.green }]}>
                    ✓ GCash{r.gcashRef ? ` · Ref: ${r.gcashRef}` : ""}
                  </Text>
                )}
                {r.note ? <Text style={styles.cardNote}>{r.note}</Text> : null}
                <Text style={styles.cardDate}>
                  {new Date(r.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · {new Date(r.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          }

          if (activeTab === "load") {
            const r = item as LoadRequest;
            const sc = STATUS_CONFIG[r.status];
            return (
              <View style={[styles.card, { borderLeftColor: sc.stripe }]}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardAmount}>₱{r.amount.toFixed(2)}</Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                    <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>
                <Text style={[styles.cardNote, { color: C.blue }]}>📱 {r.network} · {r.phone}</Text>
                {r.note ? <Text style={styles.cardNote}>{r.note}</Text> : null}
                <Text style={styles.cardDate}>
                  {new Date(r.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · {new Date(r.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          }

          // GCash card
          const req = item as CashRequest;
          const sc  = STATUS_CONFIG[req.status];
          return (
            <View style={[styles.card, { borderLeftColor: sc.stripe }]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardAmount}>
                  {req.type === "cash_in" ? "+" : "-"}₱{req.amount.toFixed(2)}
                </Text>
                <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>
              <Text style={[styles.cardNote, { color: req.type === "cash_in" ? C.green : C.coral, fontSize: 11, fontFamily: F.bold }]}>
                {req.type === "cash_in" ? "↓ Cash In" : "↑ Cash Out"}
              </Text>
              {req.note ? <Text style={styles.cardNote}>{req.note}</Text> : null}
              <Text style={styles.cardDate}>
                {new Date(req.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · {new Date(req.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {req.status === "pending" && (
                <Pressable style={({ pressed }) => [styles.notifyBtn, pressed && styles.notifyBtnPressed]} onPress={() => handleNotifyCash(req)}>
                  <Text style={styles.notifyText}>🔔 Notify Admin</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
      <GCashInfoModal config={modal} onDismiss={() => setModal(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 140 },

  header: { paddingTop: 56, paddingBottom: 8 },
  title: { color: C.text, fontSize: 28, fontFamily: F.extraBold, letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 13, fontFamily: F.medium, marginTop: 2 },

  tabRow: { flexDirection: "row", marginTop: 20, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: R.chip, alignItems: "center", flexDirection: "row", justifyContent: "center", backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  tabBtnActive: { backgroundColor: C.amber, borderColor: C.amber },
  tabText: { color: C.muted, fontFamily: F.bold, fontSize: 12 },
  tabTextActive: { color: "#0f0e0d" },
  tabBadge: { backgroundColor: C.coral, borderRadius: R.chip, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 4, marginLeft: 6 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: F.bold },

  form: { marginTop: 16, backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 20, gap: 14 },
  formTitle: { color: C.text, fontSize: 17, fontFamily: F.bold },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: C.muted2, fontSize: 11, fontFamily: F.bold, textTransform: "uppercase", letterSpacing: 0.5 },

  amountRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface2, borderRadius: R.input, paddingHorizontal: 14 },
  currencySign: { color: C.green, fontSize: 22, fontFamily: F.extraBold, marginRight: 4 },
  amountInput: { flex: 1, color: C.text, fontSize: 28, fontFamily: F.extraBold, paddingVertical: 12 },

  radioRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  radioOption: { flexDirection: "row", alignItems: "center", gap: 8 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: C.amber },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.amber },
  radioLabel: { color: C.muted, fontSize: 13, fontFamily: F.medium },

  gcashToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gcashToggleLabel: { color: C.text, fontSize: 15, fontFamily: F.bold },

  successBanner: { backgroundColor: C.green + "22", borderWidth: 1, borderColor: C.green + "55", borderRadius: R.btn, padding: 12, alignItems: "center" },
  successText: { color: C.green, fontFamily: F.bold, fontSize: 13 },

  feeBox: { backgroundColor: C.surface2, borderRadius: R.btn, padding: 14, gap: 8 },
  feeRow: { flexDirection: "row", justifyContent: "space-between" },
  feeLabel: { color: C.muted2, fontSize: 13, fontFamily: F.medium },
  feeValue: { color: C.text, fontSize: 13, fontFamily: F.medium },
  feeValueFee: { color: C.amber, fontSize: 13, fontFamily: F.semiBold },
  feeDivider: { height: 1, backgroundColor: C.line },
  feeTotalLabel: { color: C.text, fontSize: 15, fontFamily: F.bold },
  feeTotalValue: { color: C.green, fontSize: 16, fontFamily: F.extraBold },

  noteInput: { backgroundColor: C.surface2, borderRadius: R.input, borderWidth: 1, borderColor: C.line, padding: 12, color: C.text, fontSize: 14, fontFamily: F.medium, minHeight: 46 },

  submitBtn: { backgroundColor: C.amber, padding: 16, borderRadius: R.btn, alignItems: "center" },
  submitBtnOut:   { backgroundColor: C.coral },
  submitBtnPrint: { backgroundColor: C.blue },
  submitBtnLoad:  { backgroundColor: C.green },
  pressed: { opacity: 0.75 },
  submitText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },
  submitTextOut: { color: "#ffffff" },

  historyRow: { marginTop: 24, marginBottom: 8 },
  historyTitle: { color: C.muted2, fontSize: 11, fontFamily: F.bold, textTransform: "uppercase", letterSpacing: 1 },
  empty: { justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: C.muted, fontSize: 15, fontFamily: F.medium },

  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 14, gap: 6, borderLeftWidth: 4, borderWidth: 1, borderColor: C.line },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardAmount: { color: C.text, fontSize: 20, fontFamily: F.extraBold },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.chip, borderWidth: 1 },
  badgeText: { fontSize: 10.5, fontFamily: F.bold, textTransform: "uppercase", letterSpacing: 0.6 },
  cardNote: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  cardDate: { color: C.muted2, fontSize: 11, fontFamily: F.medium },

  notifyBtn: { marginTop: 4, backgroundColor: C.amber + "1A", borderWidth: 1, borderColor: C.amber, borderRadius: R.btn, paddingVertical: 10, alignItems: "center" },
  notifyBtnPressed: { transform: [{ scale: 0.97 }] },
  notifyText: { color: C.amber, fontFamily: F.bold, fontSize: 13 },
});
