import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  type Order,
  deleteAllOrders,
  deleteOrder,
  subscribeToOrders,
  updateOrderStatus,
} from "@/lib/orders";
import { C, F, R } from "@/lib/theme";

const STATUS_CONFIG: Record<Order["status"], { color: string; label: string }> =
	{
		pending: { color: C.amber, label: "PENDING" },
		confirmed: { color: C.blue, label: "CONFIRMED" },
		completed: { color: C.green, label: "COMPLETED" },
		cancelled: { color: C.coral, label: "CANCELLED" },
	};

type Filter = "all" | "cash" | "gcash" | "completed";

export default function AdminOrdersScreen() {
	const { date } = useLocalSearchParams<{ date?: string }>();
	const [orders, setOrders] = useState<Order[]>([]);
	const [filter, setFilter] = useState<Filter>("all");
	const [search, setSearch] = useState("");
	const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
	const [rejectReason, setRejectReason] = useState("");

	async function handleAccept(order: Order) {
		try {
			await updateOrderStatus(order.id, "confirmed");
		} catch (e: any) {
			if (Platform.OS === "web") window.alert(e.message);
			else Alert.alert("Error", e.message);
		}
	}

	async function handleConfirmReject() {
		if (!rejectTarget) return;
		try {
			await updateOrderStatus(rejectTarget.id, "cancelled", rejectReason.trim());
			setRejectTarget(null);
			setRejectReason("");
		} catch (e: any) {
			if (Platform.OS === "web") window.alert(e.message);
			else Alert.alert("Error", e.message);
		}
	}

	useEffect(() => {
		const unsubscribe = subscribeToOrders(setOrders);
		return () => unsubscribe();
	}, []);

	async function confirmDeleteAll() {
		const confirmed =
			Platform.OS === "web"
				? window.confirm(
						"Are you sure you want to delete all orders? This cannot be undone.",
					)
				: await new Promise<boolean>((resolve) =>
						Alert.alert("Delete All Orders", "Are you sure?", [
							{
								text: "Cancel",
								style: "cancel",
								onPress: () => resolve(false),
							},
							{
								text: "Delete All",
								style: "destructive",
								onPress: () => resolve(true),
							},
						]),
					);
		if (!confirmed) return;
		try {
			await deleteAllOrders();
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	async function confirmDeleteOrder(orderId: string) {
		const confirmed =
			Platform.OS === "web"
				? window.confirm("Delete this order? This cannot be undone.")
				: await new Promise<boolean>((resolve) =>
						Alert.alert(
							"Delete Order",
							"Are you sure you want to delete this order?",
							[
								{
									text: "Cancel",
									style: "cancel",
									onPress: () => resolve(false),
								},
								{
									text: "Delete",
									style: "destructive",
									onPress: () => resolve(true),
								},
							],
						),
					);
		if (!confirmed) return;
		try {
			await deleteOrder(orderId);
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	// If coming from bar chart tap, filter to that day only
	const dateFiltered = date
		? orders.filter((o) => {
				const shifted = new Date(o.createdAt + 4 * 60 * 60 * 1000);
				return shifted.toISOString().slice(0, 10) === date;
			})
		: orders;

	const cashCount = dateFiltered.filter(
		(o) => o.paymentStatus === "cash",
	).length;
	const gcashCount = dateFiltered.filter(
		(o) => o.paymentStatus === "gcash",
	).length;
	const completedCount = dateFiltered.filter(
		(o) => o.status === "completed" || o.status === "confirmed",
	).length;

	const STATUS_PRIORITY: Record<Order["status"], number> = {
		pending: 0,
		confirmed: 1,
		completed: 2,
		cancelled: 3,
	};

	const displayed = (
		filter === "all"
			? dateFiltered
			: dateFiltered.filter((o) =>
					filter === "completed"
						? o.status === "completed" || o.status === "confirmed"
						: o.paymentStatus === filter,
				)
	).filter((o) => {
		if (!search) return true;
		const q = search.toLowerCase();
		return (
			o.productName.toLowerCase().includes(q) ||
			o.userEmail.toLowerCase().includes(q)
		);
	}).sort((a, b) =>
		STATUS_PRIORITY[a.status] !== STATUS_PRIORITY[b.status]
			? STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
			: b.createdAt - a.createdAt,
	);

	const TABS: { key: Filter; label: string; count?: number }[] = [
		{ key: "all", label: "All" },
		{ key: "cash", label: "Cash", count: cashCount },
		{ key: "gcash", label: "GCash", count: gcashCount },
		{ key: "completed", label: "Completed", count: completedCount },
	];

	type CustomerSummaryRow = { name: string; total: number };
	type ListItem =
		| {
				type: "header";
				label: string;
				summaries: CustomerSummaryRow[];
				key: string;
		  }
		| { type: "order"; order: Order; key: string };

	function buildGrouped(list: Order[]): ListItem[] {
		// Group orders by PHT date
		const byDate: Record<string, Order[]> = {};
		for (const order of list) {
			const shifted = new Date(order.createdAt + 4 * 60 * 60 * 1000);
			const dateKey = shifted.toISOString().slice(0, 10);
			if (!byDate[dateKey]) byDate[dateKey] = [];
			byDate[dateKey].push(order);
		}

		const result: ListItem[] = [];
		// Keys already sorted newest-first because `list` is sorted
		const dateKeys = [
			...new Set(
				list.map((o) =>
					new Date(o.createdAt + 4 * 60 * 60 * 1000).toISOString().slice(0, 10),
				),
			),
		];

		for (const dateKey of dateKeys) {
			const dayOrders = byDate[dateKey] ?? [];
			const pht = new Date(dateKey + "T00:00:00+08:00");
			const todayKey = new Date(Date.now() + 4 * 60 * 60 * 1000)
				.toISOString()
				.slice(0, 10);
			const yestKey = new Date(Date.now() + 4 * 60 * 60 * 1000 - 86400000)
				.toISOString()
				.slice(0, 10);
			const label =
				dateKey === todayKey
					? "Today"
					: dateKey === yestKey
						? "Yesterday"
						: pht.toLocaleDateString("en-PH", {
								weekday: "long",
								month: "long",
								day: "numeric",
							});

			// Per-customer totals for this day (completed/confirmed only)
			const custMap: Record<string, { name: string; total: number }> = {};
			dayOrders.forEach((o) => {
				if (o.status === "completed" || o.status === "confirmed") {
					const name = o.userEmail.split("@")[0];
					if (!custMap[o.userId]) custMap[o.userId] = { name, total: 0 };
					custMap[o.userId].total += Math.abs(o.total);
				}
			});
			const summaries = Object.values(custMap).sort(
				(a, b) => b.total - a.total,
			);

			result.push({ type: "header", label, summaries, key: `h-${dateKey}` });
			dayOrders.forEach((order) =>
				result.push({ type: "order", order, key: order.id }),
			);
		}
		return result;
	}

	const groupedList = buildGrouped(displayed);

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.headerRow}>
				<View>
					<Text style={styles.header}>Live Orders</Text>
					<Text style={styles.headerSub}>
						{date
							? `Showing: ${new Date(date + "T00:00:00+08:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}`
							: "Realtime · updates instantly"}
					</Text>
				</View>
				<Pressable
					style={({ pressed }) => [
						styles.clearBtn,
						pressed && { transform: [{ scale: 0.97 }] },
					]}
					onPress={confirmDeleteAll}
				>
					<Text style={styles.clearBtnText}>Clear</Text>
				</Pressable>
			</View>

			{/* Filter Tabs */}
			<View style={styles.tabsRow}>
				{TABS.map((tab) => {
					const active = filter === tab.key;
					return (
						<Pressable
							key={tab.key}
							style={[
								styles.tab,
								active ? styles.tabActive : styles.tabInactive,
							]}
							onPress={() => setFilter(tab.key)}
						>
							<Text
								style={[
									styles.tabText,
									active ? styles.tabTextActive : styles.tabTextInactive,
								]}
							>
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

			{/* Search bar */}
			<View style={styles.searchBar}>
				<Text style={styles.searchIcon}>🔍</Text>
				<TextInput
					style={styles.searchInput}
					placeholder="Search by product or customer..."
					placeholderTextColor={C.muted2}
					value={search}
					onChangeText={setSearch}
					autoCapitalize="none"
				/>
				{search.length > 0 && (
					<Pressable onPress={() => setSearch("")}>
						<Text style={styles.searchClear}>✕</Text>
					</Pressable>
				)}
			</View>

			{displayed.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyIcon}>🧾</Text>
					<Text style={styles.emptyText}>No orders yet</Text>
				</View>
			) : (
				<FlatList
					data={groupedList}
					keyExtractor={(item) => item.key}
					contentContainerStyle={styles.list}
					ListFooterComponent={<View style={{ marginBottom: 50 }} />}
					renderItem={({ item }) => {
						if (item.type === "header") {
							return (
								<View style={styles.dateGroup}>
									<Text style={styles.dateHeader}>{item.label}</Text>
									{item.summaries.map((s) => (
										<Text key={s.name} style={styles.customerSummary}>
											{s.name} = ₱{s.total.toFixed(2)}
										</Text>
									))}
								</View>
							);
						}
						const { order } = item;
						const sc = STATUS_CONFIG[order.status];
						const avatarBg = sc.color + "26";
						const avatarBorder = sc.color + "59";
						const initial = (order.userEmail ?? "?")[0].toUpperCase();

						return (
							<View style={styles.card}>
								{/* Left: avatar */}
								<View
									style={[
										styles.avatar,
										{ backgroundColor: avatarBg, borderColor: avatarBorder },
									]}
								>
									<Text style={[styles.avatarText, { color: sc.color }]}>
										{initial}
									</Text>
								</View>

								{/* Center: details */}
								<View style={styles.cardCenter}>
									{/* Product name + CUSTOM badge */}
									<View style={styles.nameRow}>
										<Text style={styles.productName}>{order.productName}</Text>
										{order.isCustom && (
											<View style={styles.customBadge}>
												<Text style={styles.customBadgeText}>CUSTOM</Text>
											</View>
										)}
									</View>

									{/* Meta: qty · time */}
									<Text style={styles.metaText}>
										{order.quantity}× ·{" "}
										{new Date(order.createdAt).toLocaleTimeString("en-PH", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Text>

									{/* Email */}
									<Text style={styles.emailText} numberOfLines={1}>
										{order.userEmail}
									</Text>

									{/* Status badge pill */}
									<View style={styles.badgeRow}>
										<View
											style={[
												styles.statusPill,
												{
													backgroundColor: sc.color + "26",
													borderColor: sc.color + "59",
												},
											]}
										>
											<Text
												style={[styles.statusPillText, { color: sc.color }]}
											>
												{sc.label}
											</Text>
										</View>
										{order.paymentStatus === "unpaid" && (
											<View style={styles.unpaidPill}>
												<Text style={styles.unpaidPillText}>UNPAID</Text>
											</View>
										)}
										{order.paymentStatus === "cash" && (
											<View
												style={[
													styles.paymentPill,
													{
														backgroundColor: C.amber + "1A",
														borderColor: C.amber + "55",
													},
												]}
											>
												<Text
													style={[styles.paymentPillText, { color: C.amber }]}
												>
													💵 Cash
												</Text>
											</View>
										)}
										{order.paymentStatus === "gcash" && (
											<View
												style={[
													styles.paymentPill,
													{
														backgroundColor: C.blue + "1A",
														borderColor: C.blue + "55",
													},
												]}
											>
												<Text
													style={[styles.paymentPillText, { color: C.blue }]}
												>
													📱 GCash
												</Text>
											</View>
										)}
									</View>
									{order.paymentStatus === "unpaid" && order.unpaidReason ? (
										<Text style={styles.unpaidReason}>
											Reason: {order.unpaidReason}
										</Text>
									) : null}
									{order.status === "cancelled" && order.cancelReason ? (
										<Text style={styles.cancelReasonText}>
											Rejected: {order.cancelReason}
										</Text>
									) : null}
									{order.addOns && order.addOns.length > 0 && (
										<Text style={styles.addOnsText}>
											+
											{order.addOns
												.map((a) =>
													(a.quantity ?? 1) > 1
														? `${a.quantity}× ${a.name} (₱${(a.price * a.quantity!).toFixed(2)})`
														: `${a.name} (₱${a.price})`,
												)
												.join(", ")}
										</Text>
									)}
									{order.note ? (
										<Text style={styles.noteText}>Note: {order.note}</Text>
									) : null}

									{/* Action buttons */}
									{order.status === "pending" && (
										<View style={styles.pendingActionsRow}>
											<Pressable
												style={({ pressed }) => [
													styles.acceptBtn,
													pressed && { opacity: 0.8 },
												]}
												onPress={() => handleAccept(order)}
											>
												<Text style={styles.acceptBtnText}>✓ Accept</Text>
											</Pressable>
											<Pressable
												style={({ pressed }) => [
													styles.rejectBtn,
													pressed && { opacity: 0.8 },
												]}
												onPress={() => {
													setRejectReason("");
													setRejectTarget(order);
												}}
											>
												<Text style={styles.rejectBtnText}>✕ Reject</Text>
											</Pressable>
										</View>
									)}
									{order.status === "confirmed" && (
										<Pressable
											style={styles.completeBtn}
											onPress={() => updateOrderStatus(order.id, "completed")}
										>
											<Text style={styles.completeBtnText}>Mark Completed</Text>
										</Pressable>
									)}
								</View>

								{/* Right: order total */}
								<View style={styles.cardRight}>
									<Text
										style={[
											styles.totalText,
											order.paymentStatus === "unpaid" && { color: C.coral },
										]}
									>
										{order.paymentStatus === "unpaid" ? "-" : ""}₱
										{Math.abs(order.total).toFixed(2)}
									</Text>
									<Pressable
										style={({ pressed }) => [
											styles.deleteBtn,
											pressed && { opacity: 0.7 },
										]}
										onPress={() => confirmDeleteOrder(order.id)}
										hitSlop={8}
									>
										<Text style={styles.deleteBtnText}>🗑️</Text>
									</Pressable>
								</View>
							</View>
						);
					}}
				/>
			)}

			{/* Reject order modal */}
			<Modal
				transparent
				visible={rejectTarget !== null}
				animationType="fade"
				statusBarTranslucent
				onRequestClose={() => setRejectTarget(null)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Reject Order</Text>
						<Text style={styles.modalMessage}>
							Reject{" "}
							<Text style={styles.modalHighlight}>
								{rejectTarget?.productName}
							</Text>{" "}
							from {rejectTarget?.userEmail}?
						</Text>
						<TextInput
							style={styles.modalInput}
							placeholder="Reason for rejection (optional)"
							placeholderTextColor={C.muted2}
							value={rejectReason}
							onChangeText={setRejectReason}
							returnKeyType="done"
						/>
						<View style={styles.modalBtnRow}>
							<Pressable
								style={({ pressed }) => [
									styles.modalBtn,
									styles.modalBtnCancel,
									pressed && { opacity: 0.8 },
								]}
								onPress={() => setRejectTarget(null)}
							>
								<Text style={styles.modalBtnCancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								style={({ pressed }) => [
									styles.modalBtn,
									styles.modalBtnReject,
									pressed && { opacity: 0.8 },
								]}
								onPress={handleConfirmReject}
							>
								<Text style={styles.modalBtnRejectText}>✕ Reject</Text>
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
	dateGroup: {
		paddingTop: 16,
		paddingBottom: 8,
		gap: 2,
	},
	dateHeader: {
		color: C.text,
		fontSize: 15,
		fontFamily: F.extraBold,
		marginBottom: 4,
	},
	customerSummary: {
		color: C.muted2,
		fontSize: 12,
		fontFamily: F.medium,
	},

	/* Header */
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingTop: 56,
		paddingBottom: 12,
	},
	header: { color: C.text, fontSize: 28, fontFamily: F.extraBold },
	headerSub: {
		color: C.muted2,
		fontSize: 11,
		fontFamily: F.medium,
		marginTop: 2,
	},
	clearBtn: {
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: C.coral,
		borderRadius: R.btn,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	clearBtnText: { color: C.coral, fontFamily: F.bold, fontSize: 13 },

	/* Filter Tabs */
	tabsRow: {
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 20,
		paddingBottom: 12,
	},
	tab: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: R.chip,
	},
	tabActive: { backgroundColor: C.amber },
	tabInactive: {
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
	},
	tabText: { fontFamily: F.bold },
	tabTextActive: { color: "#0f0e0d" },
	tabTextInactive: { color: C.muted },
	countBubble: {
		backgroundColor: C.coral,
		borderRadius: 999,
		minWidth: 16,
		height: 16,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 3,
	},
	countBubbleText: { color: "#ffffff", fontFamily: F.bold, fontSize: 9 },

	/* Empty */
	empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
	emptyIcon: { fontSize: 40 },
	emptyText: { color: C.muted, fontSize: 16, fontFamily: F.medium },

	/* List */
	list: { padding: 16, gap: 12, paddingBottom: 100 },

	/* Card */
	card: {
		backgroundColor: C.surface,
		borderRadius: R.card,
		borderWidth: 1,
		borderColor: C.line,
		padding: 16,
		flexDirection: "row",
		gap: 12,
		alignItems: "flex-start",
	},

	/* Avatar */
	avatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 1.5,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarText: { fontSize: 18, fontFamily: F.extraBold },

	/* Center */
	cardCenter: { flex: 1 },
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
		marginBottom: 2,
	},
	productName: { color: C.text, fontSize: 16, fontFamily: F.extraBold },
	customBadge: {
		backgroundColor: C.blue + "1A",
		borderRadius: 4,
		paddingHorizontal: 5,
		paddingVertical: 1,
	},
	customBadgeText: { color: C.blue, fontFamily: F.bold, fontSize: 10 },
	metaText: {
		color: C.muted2,
		fontSize: 12.5,
		fontFamily: F.medium,
		marginBottom: 2,
	},
	emailText: { color: C.muted2, fontSize: 11, fontFamily: F.medium },
	statusPill: {
		borderWidth: 1,
		borderRadius: R.chip,
		paddingHorizontal: 8,
		paddingVertical: 3,
		marginTop: 6,
	},
	statusPillText: {
		fontFamily: F.bold,
		fontSize: 10.5,
		textTransform: "uppercase",
	},

	/* Actions */
	pendingActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
	acceptBtn: {
		flex: 1,
		backgroundColor: C.green,
		borderRadius: R.btn,
		padding: 11,
		alignItems: "center",
	},
	acceptBtnText: { color: "#0f0e0d", fontFamily: F.bold, fontSize: 14 },
	rejectBtn: {
		flex: 1,
		backgroundColor: C.coral,
		borderRadius: R.btn,
		padding: 11,
		alignItems: "center",
	},
	rejectBtnText: { color: "#ffffff", fontFamily: F.bold, fontSize: 14 },

	/* Reject modal */
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.8)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
	},
	modalCard: {
		width: "100%",
		maxWidth: 400,
		backgroundColor: C.surface,
		borderRadius: 24,
		paddingVertical: 28,
		paddingHorizontal: 24,
		borderWidth: 1,
		borderColor: C.line,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 20 },
		shadowOpacity: 0.6,
		shadowRadius: 30,
		elevation: 20,
		gap: 14,
	},
	modalTitle: {
		color: C.text,
		fontSize: 20,
		fontFamily: F.extraBold,
		textAlign: "center",
	},
	modalMessage: {
		color: C.muted,
		fontSize: 14,
		fontFamily: F.medium,
		textAlign: "center",
		lineHeight: 22,
	},
	modalHighlight: { color: C.text, fontFamily: F.bold },
	modalInput: {
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
		borderRadius: R.btn,
		paddingHorizontal: 14,
		paddingVertical: 11,
		color: C.text,
		fontFamily: F.medium,
		fontSize: 14,
	},
	modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
	modalBtn: {
		flex: 1,
		borderRadius: R.btn,
		paddingVertical: 13,
		alignItems: "center",
	},
	modalBtnCancel: {
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
	},
	modalBtnCancelText: { color: C.muted, fontFamily: F.bold, fontSize: 14 },
	modalBtnReject: { backgroundColor: C.coral },
	modalBtnRejectText: { color: "#ffffff", fontFamily: F.bold, fontSize: 14 },

	completeBtn: {
		backgroundColor: C.green,
		borderRadius: R.btn,
		padding: 11,
		alignItems: "center",
		marginTop: 8,
	},
	completeBtnText: { color: "#ffffff", fontFamily: F.bold, fontSize: 14 },

	/* Right */
	cardRight: { alignItems: "flex-end", gap: 4 },
	customerTotalText: { color: C.muted2, fontSize: 10, fontFamily: F.medium },
	totalText: {
		color: C.green,
		fontFamily: F.extraBold,
		fontSize: 19,
		letterSpacing: -0.4,
	},
	deleteBtn: {
		marginTop: 6,
		width: 28,
		height: 28,
		borderRadius: 8,
		backgroundColor: C.coral + "1A",
		borderWidth: 1,
		borderColor: C.coral + "44",
		justifyContent: "center",
		alignItems: "center",
	},
	deleteBtnText: { fontSize: 13 },
	badgeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 6,
		flexWrap: "wrap",
	},
	unpaidPill: {
		backgroundColor: C.coral + "26",
		borderWidth: 1,
		borderColor: C.coral + "59",
		borderRadius: R.chip,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	unpaidPillText: {
		color: C.coral,
		fontFamily: F.bold,
		fontSize: 10.5,
		textTransform: "uppercase",
	},
	unpaidReason: {
		color: C.muted,
		fontFamily: F.medium,
		fontSize: 12,
		marginTop: 3,
	},
	addOnsText: {
		color: C.blue,
		fontFamily: F.medium,
		fontSize: 12,
		marginTop: 3,
	},
	noteText: {
		color: C.muted,
		fontFamily: F.medium,
		fontSize: 12,
		marginTop: 2,
		fontStyle: "italic",
	},
	cancelReasonText: {
		color: C.coral,
		fontFamily: F.medium,
		fontSize: 12,
		marginTop: 3,
	},
	paymentPill: {
		borderWidth: 1,
		borderRadius: R.chip,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	paymentPillText: { fontFamily: F.bold, fontSize: 10.5 },

	searchBar: {
		flexDirection: "row", alignItems: "center",
		backgroundColor: C.surface, borderRadius: R.input,
		marginHorizontal: 20, marginBottom: 12,
		paddingHorizontal: 12,
		borderWidth: 1, borderColor: C.line,
	},
	searchIcon: { fontSize: 16, marginRight: 8 },
	searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 12, fontFamily: F.medium },
	searchClear: { color: C.muted2, fontSize: 16, padding: 4 },
});
