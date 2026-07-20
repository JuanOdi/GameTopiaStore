import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { createPrintRecord } from "@/lib/gcash";
import { C, F, R } from "@/lib/theme";

export default function PrintScreen() {
	const { user } = useAuth();
	const [customerName, setCustomerName] = useState("");
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const [withGcash, setWithGcash] = useState(false);
	const [gcashRef, setGcashRef] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	async function handleSubmit() {
		const parsed = parseFloat(amount);
		if (!customerName.trim()) {
			if (Platform.OS === "web") window.alert("Please enter a name.");
			else Alert.alert("Error", "Please enter a name.");
			return;
		}
		if (!parsed || parsed <= 0) {
			if (Platform.OS === "web") window.alert("Please enter a valid amount.");
			else Alert.alert("Error", "Please enter a valid amount.");
			return;
		}
		if (!user) return;

		setLoading(true);
		try {
			await createPrintRecord(
				user.uid,
				user.email ?? "",
				customerName,
				parsed,
				withGcash,
				gcashRef,
				note,
			);
			setSubmitted(true);
			setCustomerName("");
			setAmount("");
			setNote("");
			setGcashRef("");
			setWithGcash(true);
			setTimeout(() => setSubmitted(false), 3000);
		} catch (e: any) {
			if (Platform.OS === "web") window.alert(e.message);
			else Alert.alert("Error", e.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>Print Receipt</Text>
			<Text style={styles.subtitle}>
				Submit a payment record to admin history
			</Text>

			{submitted && (
				<View style={styles.successBanner}>
					<Text style={styles.successText}>✅ Record submitted to admin!</Text>
				</View>
			)}

			{/* Customer Info */}
			<View style={styles.card}>
				<View style={styles.field}>
					<Text style={styles.label}>NAME *</Text>
					<TextInput
						style={styles.input}
						placeholder="Customer name..."
						placeholderTextColor={C.muted2}
						value={customerName}
						onChangeText={setCustomerName}
						autoCapitalize="words"
					/>
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>AMOUNT *</Text>
					<View style={styles.amountRow}>
						<Text style={styles.currency}>₱</Text>
						<TextInput
							style={styles.amountInput}
							placeholder="0.00"
							placeholderTextColor={C.muted2}
							value={amount}
							onChangeText={setAmount}
							keyboardType="decimal-pad"
						/>
					</View>
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>NOTE (optional)</Text>
					<TextInput
						style={styles.input}
						placeholder="e.g. item name, description..."
						placeholderTextColor={C.muted2}
						value={note}
						onChangeText={setNote}
					/>
				</View>
			</View>

			{/* GCash Toggle */}
			<View style={styles.card}>
				<Pressable
					style={styles.toggleRow}
					onPress={() => setWithGcash((v) => !v)}
				>
					<View style={styles.toggleLeft}>
						<Text style={styles.toggleTitle}>GCash Payment</Text>
						<Text style={styles.toggleSub}>Mark this as paid via GCash</Text>
					</View>
					<Switch
						value={withGcash}
						onValueChange={setWithGcash}
						trackColor={{ false: C.surface3, true: C.green + "55" }}
						thumbColor={withGcash ? C.green : C.muted2}
					/>
				</Pressable>

				{withGcash && (
					<View style={[styles.field, { marginTop: 14 }]}>
						<Text style={styles.label}>GCASH REFERENCE # (optional)</Text>
						<TextInput
							style={styles.input}
							placeholder="e.g. 1234567890"
							placeholderTextColor={C.muted2}
							value={gcashRef}
							onChangeText={setGcashRef}
							keyboardType="number-pad"
						/>
					</View>
				)}
			</View>

			<Pressable
				style={({ pressed }) => [
					styles.submitBtn,
					pressed && { opacity: 0.85 },
					loading && { opacity: 0.6 },
				]}
				onPress={handleSubmit}
				disabled={loading}
			>
				<Text style={styles.submitText}>
					{loading ? "Submitting..." : "📋  Submit to Admin"}
				</Text>
			</Pressable>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },
	content: { padding: 20, paddingTop: 56, paddingBottom: 120, gap: 16 },

	title: {
		color: C.text,
		fontSize: 28,
		fontFamily: F.extraBold,
		letterSpacing: -0.5,
	},
	subtitle: {
		color: C.muted2,
		fontSize: 13,
		fontFamily: F.medium,
		marginTop: 2,
	},

	successBanner: {
		backgroundColor: C.green + "22",
		borderWidth: 1,
		borderColor: C.green + "55",
		borderRadius: R.btn,
		padding: 14,
		alignItems: "center",
	},
	successText: { color: C.green, fontFamily: F.bold, fontSize: 14 },

	card: {
		backgroundColor: C.surface,
		borderRadius: R.card,
		borderWidth: 1,
		borderColor: C.line,
		padding: 16,
		gap: 14,
	},

	field: { gap: 6 },
	label: {
		color: C.muted2,
		fontSize: 11,
		fontFamily: F.bold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},

	input: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		borderWidth: 1,
		borderColor: C.line,
		padding: 13,
		color: C.text,
		fontSize: 15,
		fontFamily: F.medium,
	},

	amountRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface2,
		borderRadius: R.input,
		borderWidth: 1,
		borderColor: C.line,
		paddingHorizontal: 14,
	},
	currency: {
		color: C.green,
		fontSize: 20,
		fontFamily: F.bold,
		marginRight: 4,
	},
	amountInput: {
		flex: 1,
		color: C.text,
		fontSize: 28,
		fontFamily: F.bold,
		paddingVertical: 10,
	},

	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	toggleLeft: { gap: 2 },
	toggleTitle: { color: C.text, fontSize: 15, fontFamily: F.bold },
	toggleSub: { color: C.muted2, fontSize: 12, fontFamily: F.medium },

	submitBtn: {
		backgroundColor: C.amber,
		borderRadius: R.btn,
		padding: 16,
		alignItems: "center",
	},
	submitText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },
});
