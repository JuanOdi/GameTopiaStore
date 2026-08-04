import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  type CashRequest,
  type PrintRecord,
  deleteAllCashRequests,
  deleteAllPrintRecords,
  subscribeToAllCashRequests,
  subscribeToAllPrintRecords,
  updateCashRequestStatus,
} from "@/lib/gcash";
import {
  type LoadRequest,
  deleteAllLoadRequests,
  subscribeToAllLoadRequests,
} from "@/lib/load";
import { C, F, R } from "@/lib/theme";

type Filter = "all" | "cash_in" | "cash_out" | "print" | "load";

type ListEntry =
	| { kind: "cash"; data: CashRequest }
	| { kind: "print"; data: PrintRecord }
	| { kind: "load"; data: LoadRequest };

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AdminGCashScreen() {
	const [requests, setRequests] = useState<CashRequest[]>([]);
	const [printRecords, setPrintRecords] = useState<PrintRecord[]>([]);
	const [loadRequests, setLoadRequests] = useState<LoadRequest[]>([]);
	const [filter, setFilter] = useState<Filter>("all");

	useEffect(() => {
		return subscribeToAllCashRequests(setRequests);
	}, []);
	useEffect(() => {
		return subscribeToAllPrintRecords(setPrintRecords);
	}, []);
	useEffect(() => {
		return subscribeToAllLoadRequests(setLoadRequests);
	}, []);

	async function handleDeleteGCash() {
		const ok =
			Platform.OS === "web"
				? window.confirm("Delete all GCash transactions?")
				: await new Promise<boolean>((res) =>
						Alert.alert(
							"Delete GCash Records",
							"Delete all GCash transactions? Print and Load records will NOT be affected.",
							[
								{ text: "Cancel", style: "cancel", onPress: () => res(false) },
								{
									text: "Delete",
									style: "destructive",
									onPress: () => res(true),
								},
							],
						),
					);
		if (!ok) return;
		try {
			await deleteAllCashRequests();
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	async function handleDeletePrints() {
		const ok =
			Platform.OS === "web"
				? window.confirm("Delete all print records?")
				: await new Promise<boolean>((res) =>
						Alert.alert("Delete Print Records", "Delete all print history?", [
							{ text: "Cancel", style: "cancel", onPress: () => res(false) },
							{
								text: "Delete",
								style: "destructive",
								onPress: () => res(true),
							},
						]),
					);
		if (!ok) return;
		try {
			await deleteAllPrintRecords();
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	async function handleDeleteLoads() {
		const ok =
			Platform.OS === "web"
				? window.confirm("Delete all load records?")
				: await new Promise<boolean>((res) =>
						Alert.alert("Delete Load Records", "Delete all load history?", [
							{ text: "Cancel", style: "cancel", onPress: () => res(false) },
							{
								text: "Delete",
								style: "destructive",
								onPress: () => res(true),
							},
						]),
					);
		if (!ok) return;
		try {
			await deleteAllLoadRequests();
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	async function handleApproveCash(id: string) {
		try {
			await updateCashRequestStatus(id, "approved");
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	async function handleRejectCash(id: string) {
		const ok =
			Platform.OS === "web"
				? window.confirm("Reject this request?")
				: await new Promise<boolean>((res) =>
						Alert.alert("Reject Request", "Are you sure?", [
							{ text: "Cancel", style: "cancel", onPress: () => res(false) },
							{
								text: "Reject",
								style: "destructive",
								onPress: () => res(true),
							},
						]),
					);
		if (!ok) return;
		try {
			await updateCashRequestStatus(id, "rejected");
		} catch (e: any) {
			Alert.alert("Error", e.message);
		}
	}

	// Merge + sort
	const allEntries: ListEntry[] = [
		...requests.map((r): ListEntry => ({ kind: "cash", data: r })),
		...printRecords.map((r): ListEntry => ({ kind: "print", data: r })),
		...loadRequests.map((r): ListEntry => ({ kind: "load", data: r })),
	].sort((a, b) => b.data.createdAt - a.data.createdAt);

	const filtered = allEntries.filter((e) => {
		if (filter === "all") return true;
		if (filter === "print") return e.kind === "print";
		if (filter === "load") return e.kind === "load";
		if (filter === "cash_in")
			return e.kind === "cash" && (e.data as CashRequest).type === "cash_in";
		if (filter === "cash_out")
			return e.kind === "cash" && (e.data as CashRequest).type === "cash_out";
		return true;
	});

	const pendingCash = requests.filter((r) => r.status === "pending").length;
	const pendingLoad = loadRequests.filter((r) => r.status === "pending").length;
	const totalPending = pendingCash + pendingLoad;

	const FILTER_TABS: { key: Filter; label: string; badge?: number }[] = [
		{ key: "all", label: "All" },
		{
			key: "cash_in",
			label: "Cash In",
			badge: requests.filter(
				(r) => r.type === "cash_in" && r.status === "pending",
			).length,
		},
		{
			key: "cash_out",
			label: "Cash Out",
			badge: requests.filter(
				(r) => r.type === "cash_out" && r.status === "pending",
			).length,
		},
		{ key: "print", label: "🖨️ Print" },
		{ key: "load", label: "📱 Load", badge: pendingLoad },
	];

	return (
		<View style={styles.container}>
			{/* Header */}
			<View style={styles.headerRow}>
				<View style={styles.headerLeft}>
					<Text style={styles.header}>GCash & Print</Text>
					{totalPending > 0 && (
						<Text style={styles.pendingHint}>
							{totalPending} pending request{totalPending > 1 ? "s" : ""}
						</Text>
					)}
				</View>
				{filter === "print" && printRecords.length > 0 && (
					<Pressable
						style={({ pressed }) => [
							styles.deleteAllBtn,
							pressed && { opacity: 0.7 },
						]}
						onPress={handleDeletePrints}
					>
						<Text style={styles.deleteAllText}>Delete Prints</Text>
					</Pressable>
				)}
				{filter === "load" && loadRequests.length > 0 && (
					<Pressable
						style={({ pressed }) => [
							styles.deleteAllBtn,
							pressed && { opacity: 0.7 },
						]}
						onPress={handleDeleteLoads}
					>
						<Text style={styles.deleteAllText}>Delete Loads</Text>
					</Pressable>
				)}
				{(filter === "all" || filter === "cash_in" || filter === "cash_out") &&
					requests.length > 0 && (
						<Pressable
							style={({ pressed }) => [
								styles.deleteAllBtn,
								pressed && { opacity: 0.7 },
							]}
							onPress={handleDeleteGCash}
						>
							<Text style={styles.deleteAllText}>Delete GCash</Text>
						</Pressable>
					)}
			</View>

			{/* Filter tabs */}
			<View style={styles.filterRow}>
				{FILTER_TABS.map((tab) => {
					const active = filter === tab.key;
					return (
						<Pressable
							key={tab.key}
							style={[styles.filterBtn, active && styles.filterBtnActive]}
							onPress={() => setFilter(tab.key)}
						>
							<Text
								style={[styles.filterText, active && styles.filterTextActive]}
							>
								{tab.label}
							</Text>
							{(tab.badge ?? 0) > 0 && (
								<View style={styles.filterBadge}>
									<Text style={styles.filterBadgeText}>
										{tab.badge! > 9 ? "9+" : tab.badge}
									</Text>
								</View>
							)}
						</Pressable>
					);
				})}
			</View>

			{filtered.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyIcon}>
						{filter === "load" ? "📱" : filter === "print" ? "🖨️" : "💳"}
					</Text>
					<Text style={styles.emptyText}>No records found</Text>
				</View>
			) : (
				<FlatList
					data={filtered}
					keyExtractor={(item) => `${item.kind}-${item.data.id}`}
					contentContainerStyle={styles.list}
					ListFooterComponent={<View style={{ marginBottom: 50 }} />}
					renderItem={({ item }) => {
						// ── Print card ──
						if (item.kind === "print") {
							const r = item.data as PrintRecord;
							return (
								<View style={[styles.card, styles.printCard]}>
									<View
										style={[
											styles.avatar,
											{
												backgroundColor: C.blue + "26",
												borderColor: C.blue + "59",
											},
										]}
									>
										<Text style={styles.avatarText}>🖨️</Text>
									</View>
									<View style={styles.cardCenter}>
										<Text style={styles.cardEmail}>{r.customerName}</Text>
										<Text style={styles.cardNote}>{r.userEmail}</Text>
										{r.note ? (
											<Text style={styles.cardNote}>{r.note}</Text>
										) : null}
										<Text
											style={[
												styles.cardType,
												{ color: r.withGcash ? C.green : C.muted },
											]}
										>
											{r.withGcash ? "✓ GCash Paid" : "Cash"}
											{r.withGcash && r.gcashRef ? ` · Ref: ${r.gcashRef}` : ""}
										</Text>
										<View
											style={[
												styles.statusBadge,
												{
													backgroundColor: C.blue + "1A",
													borderColor: C.blue + "55",
												},
											]}
										>
											<Text style={[styles.statusBadgeText, { color: C.blue }]}>
												PRINT RECORD
											</Text>
										</View>
									</View>
									<View style={styles.cardRight}>
										<Text style={[styles.cardAmount, { color: C.blue }]}>
											₱{r.amount.toFixed(2)}
										</Text>
										<Text style={styles.cardTime}>
											{new Date(r.createdAt).toLocaleDateString("en-PH", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</Text>
										<Text style={styles.cardTime}>
											{new Date(r.createdAt).toLocaleTimeString("en-PH", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</Text>
									</View>
								</View>
							);
						}

						// ── Load card ──
						if (item.kind === "load") {
							const r = item.data as LoadRequest;
							const statusColor =
								r.status === "approved"
									? C.green
									: r.status === "rejected"
										? C.coral
										: C.amber;
							const statusLabel =
								r.status === "approved"
									? "APPROVED"
									: r.status === "rejected"
										? "REJECTED"
										: "PENDING";
							return (
								<View style={[styles.card, styles.loadCard]}>
									<View
										style={[
											styles.avatar,
											{
												backgroundColor: C.green + "26",
												borderColor: C.green + "59",
											},
										]}
									>
										<Text style={styles.avatarText}>📱</Text>
									</View>
									<View style={styles.cardCenter}>
										<Text style={styles.cardEmail} numberOfLines={1}>
											{r.userEmail}
										</Text>
										<Text style={[styles.cardType, { color: C.green }]}>
											{r.network} · {r.phone}
										</Text>
										{r.note ? (
											<Text style={styles.cardNote}>{r.note}</Text>
										) : null}
										<View
											style={[
												styles.statusBadge,
												{
													backgroundColor: statusColor + "26",
													borderColor: statusColor + "59",
												},
											]}
										>
											<Text
												style={[styles.statusBadgeText, { color: statusColor }]}
											>
												{statusLabel}
											</Text>
										</View>
									</View>
									<View style={styles.cardRight}>
										<Text style={[styles.cardAmount, { color: C.green }]}>
											₱{r.amount.toFixed(2)}
										</Text>
										<Text style={styles.cardTime}>
											{new Date(r.createdAt).toLocaleDateString("en-PH", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</Text>
										<Text style={styles.cardTime}>
											{new Date(r.createdAt).toLocaleTimeString("en-PH", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</Text>
									</View>
								</View>
							);
						}

						// ── Cash card ──
						const req = item.data as CashRequest;
						const avatarColor =
							req.status === "pending"
								? C.amber
								: req.status === "approved"
									? C.green
									: C.coral;
						const statusLabel =
							req.status === "pending"
								? "PENDING"
								: req.status === "approved"
									? "APPROVED"
									: "REJECTED";
						return (
							<View style={styles.card}>
								<View
									style={[
										styles.avatar,
										{
											backgroundColor: avatarColor + "26",
											borderColor: avatarColor + "59",
										},
									]}
								>
									<Text style={[styles.avatarText, { color: avatarColor }]}>
										{req.userEmail.charAt(0).toUpperCase()}
									</Text>
								</View>
								<View style={styles.cardCenter}>
									<Text style={styles.cardEmail} numberOfLines={1}>
										{req.userEmail}
									</Text>
									{req.note ? (
										<Text style={styles.cardNote}>{req.note}</Text>
									) : null}
									<Text
										style={[
											styles.cardType,
											{ color: req.type === "cash_in" ? C.green : C.coral },
										]}
									>
										{req.type === "cash_in" ? "↓ Cash In" : "↑ Cash Out"}
									</Text>
									<View
										style={[
											styles.statusBadge,
											{
												backgroundColor: avatarColor + "26",
												borderColor: avatarColor + "59",
											},
										]}
									>
										<Text
											style={[styles.statusBadgeText, { color: avatarColor }]}
										>
											{statusLabel}
										</Text>
									</View>
									{req.status === "pending" && (
										<View style={styles.actions}>
											<Pressable
												style={({ pressed }) => [
													styles.approveBtn,
													pressed && { opacity: 0.8 },
												]}
												onPress={() => handleApproveCash(req.id)}
											>
												<Text style={styles.approveBtnText}>✓ Approve</Text>
											</Pressable>
											<Pressable
												style={({ pressed }) => [
													styles.rejectBtn,
													pressed && { opacity: 0.8 },
												]}
												onPress={() => handleRejectCash(req.id)}
											>
												<Text style={styles.rejectBtnText}>✕</Text>
											</Pressable>
										</View>
									)}
								</View>
								<View style={styles.cardRight}>
									<Text style={styles.cardAmount}>
										₱{req.amount.toFixed(2)}
									</Text>
									{(req.fee ?? 0) > 0 && (
										<Text style={styles.cardFee}>
											+₱{(req.fee ?? 0).toFixed(2)} earn
											{req.withFee ? "" : " (absorbed)"}
										</Text>
									)}
									<Text style={styles.cardTime}>
										{new Date(req.createdAt).toLocaleDateString("en-PH", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</Text>
									<Text style={styles.cardTime}>
										{new Date(req.createdAt).toLocaleTimeString("en-PH", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Text>
								</View>
							</View>
						);
					}}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		paddingTop: 56,
	},
	headerLeft: { flex: 1 },
	header: { color: C.text, fontSize: 28, fontFamily: F.extraBold },
	pendingHint: {
		color: C.amber,
		fontSize: 13,
		fontFamily: F.medium,
		marginTop: 2,
	},
	deleteAllBtn: {
		borderWidth: 1,
		borderColor: C.coral,
		borderRadius: R.btn,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	deleteAllText: { color: C.coral, fontSize: 13, fontFamily: F.bold },

	filterRow: {
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 16,
		paddingBottom: 12,
		flexWrap: "wrap",
	},
	filterBtn: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: R.chip,
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
	},
	filterBtnActive: { backgroundColor: C.amber, borderColor: C.amber },
	filterText: { color: C.muted, fontSize: 13, fontFamily: F.bold },
	filterTextActive: { color: "#0f0e0d" },
	filterBadge: {
		backgroundColor: C.coral,
		borderRadius: 999,
		minWidth: 16,
		height: 16,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
		marginLeft: 6,
	},
	filterBadgeText: { color: "#fff", fontSize: 9, fontFamily: F.bold },

	empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
	emptyIcon: { fontSize: 40 },
	emptyText: { color: C.muted, fontSize: 16, fontFamily: F.medium },

	list: { padding: 16, paddingBottom: 100, gap: 10 },

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
	printCard: { borderLeftWidth: 3, borderLeftColor: C.blue },
	loadCard: { borderLeftWidth: 3, borderLeftColor: C.green },

	avatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 1.5,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarText: { fontSize: 18, fontFamily: F.extraBold },

	cardCenter: { flex: 1, gap: 4 },
	cardEmail: { color: C.text, fontSize: 14, fontFamily: F.bold },
	cardNote: { color: C.muted, fontSize: 12, fontFamily: F.medium },
	cardType: { fontSize: 13, fontFamily: F.medium },
	tapHint: {
		color: C.muted2,
		fontSize: 11,
		fontFamily: F.medium,
		marginTop: 2,
	},
	statusBadge: {
		borderWidth: 1,
		borderRadius: R.chip,
		paddingHorizontal: 8,
		paddingVertical: 3,
		alignSelf: "flex-start",
	},
	statusBadgeText: {
		fontSize: 10.5,
		fontFamily: F.bold,
		textTransform: "uppercase",
	},

	actions: { flexDirection: "row", gap: 8, marginTop: 8 },
	approveBtn: {
		flex: 1,
		backgroundColor: C.green,
		borderRadius: R.btn,
		padding: 10,
		alignItems: "center",
	},
	approveBtnText: { color: "#fff", fontFamily: F.bold, fontSize: 14 },
	rejectBtn: {
		width: 44,
		height: 44,
		backgroundColor: C.coral + "1A",
		borderRadius: R.btn,
		borderWidth: 1,
		borderColor: C.coral + "59",
		justifyContent: "center",
		alignItems: "center",
	},
	rejectBtnText: { color: C.coral, fontFamily: F.bold, fontSize: 16 },

	cardRight: { alignItems: "flex-end", gap: 4 },
	cardAmount: {
		color: C.green,
		fontSize: 19,
		fontFamily: F.extraBold,
		letterSpacing: -0.4,
	},
	cardFee: { color: C.amber, fontSize: 12, fontFamily: F.medium },
	cardTime: { color: C.muted2, fontSize: 11, fontFamily: F.medium },
});
