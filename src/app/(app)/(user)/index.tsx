import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/hooks/use-auth";
import { C, F, R } from "@/lib/theme";
import { createOrder } from "@/lib/orders";
import {
  type AddOn,
  type Product,
  seedSampleProducts,
  subscribeToProducts,
} from "@/lib/products";
import { subscribeToStoreStatus } from "@/lib/store-settings";

type CartItem = {
	cartId: string;
	product: Product;
	quantity: number;
	addOns: AddOn[];
	isCustom?: boolean;
};

function OrderSuccessModal({ visible, count, onDismiss }: { visible: boolean; count: number; onDismiss: () => void }) {
	const slideAnim = useRef(new Animated.Value(60)).current;
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const scaleAnim = useRef(new Animated.Value(0.85)).current;
	const pulseAnim = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		if (!visible) return;
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
	}, [visible]);

	const handleDismiss = () => {
		Animated.parallel([
			Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
			Animated.timing(slideAnim, { toValue: 40, duration: 200, useNativeDriver: true }),
		]).start(onDismiss);
	};

	return (
		<Modal transparent visible={visible} animationType="none" statusBarTranslucent>
			<Animated.View style={[successStyles.overlay, { opacity: fadeAnim }]}>
				<Animated.View style={[successStyles.card, { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
					<View style={successStyles.iconOuter}>
						<Animated.View style={[successStyles.iconPulse, { transform: [{ scale: pulseAnim }] }]} />
						<View style={successStyles.iconCircle}>
							<Ionicons name="checkmark-circle" size={30} color={C.green} />
						</View>
					</View>
					<Text style={successStyles.title}>Order Sent!</Text>
					<View style={successStyles.divider} />
					<Text style={successStyles.message}>
						{count} item{count > 1 ? "s" : ""} ordered successfully.{"\n"}The admin will confirm your order shortly.
					</Text>
					<Pressable
						style={({ pressed }) => [successStyles.btn, pressed && successStyles.btnPressed]}
						onPress={handleDismiss}>
						<Ionicons name="checkmark" size={18} color={C.bg} />
						<Text style={successStyles.btnText}>Got it</Text>
					</Pressable>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

const successStyles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.8)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
	},
	card: {
		width: "100%",
		backgroundColor: C.surface,
		borderRadius: 24,
		paddingVertical: 32,
		paddingHorizontal: 28,
		alignItems: "center",
		borderWidth: 1,
		borderColor: C.line,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 20 },
		shadowOpacity: 0.6,
		shadowRadius: 30,
		elevation: 20,
		gap: 16,
	},
	iconOuter: { width: 80, height: 80, justifyContent: "center", alignItems: "center", marginBottom: 4 },
	iconPulse: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: C.green + "22" },
	iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green + "22", justifyContent: "center", alignItems: "center" },
	title: { color: C.text, fontSize: 20, fontFamily: F.extraBold, textAlign: "center", letterSpacing: 0.3 },
	divider: { width: 40, height: 2, backgroundColor: C.line, borderRadius: 2 },
	message: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22 },
	btn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: C.green,
		borderRadius: 14,
		paddingVertical: 14,
		paddingHorizontal: 40,
		marginTop: 8,
		shadowColor: C.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 8,
	},
	btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
	btnText: { color: C.bg, fontSize: 16, fontFamily: F.bold, letterSpacing: 0.5 },
});



function cartItemTotal(item: CartItem): number {
	const addOnsTotal = item.addOns.reduce((sum, a) => sum + a.price * (a.quantity ?? 1), 0);
	return item.product.price * item.quantity + addOnsTotal;
}

export default function StoreScreen() {
	const { user } = useAuth();
	const { width } = useWindowDimensions();
	const [products, setProducts] = useState<Product[]>([]);
	const [selected, setSelected] = useState<Product | null>(null);
	const [quantity, setQuantity] = useState(1);
	const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
	const [activeCategory, setActiveCategory] = useState("All");
	const [isStoreOpen, setIsStoreOpen] = useState(true);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [cartVisible, setCartVisible] = useState(false);
	const [note, setNote] = useState("");
	const [loading, setLoading] = useState(false);
	const [cashInput, setCashInput] = useState("");
	const [customModalVisible, setCustomModalVisible] = useState(false);
	const [customName, setCustomName] = useState("");
	const [customPrice, setCustomPrice] = useState("");
	const [search, setSearch] = useState("");
	const [paymentStatus, setPaymentStatus] = useState<"cash" | "gcash" | "unpaid">("cash");
	const [unpaidReason, setUnpaidReason] = useState("");
	const [successVisible, setSuccessVisible] = useState(false);
	const [successCount, setSuccessCount] = useState(0);

	const isTablet = width >= 768;
	// Responsive grid: fit as many columns as the screen allows, cards stretch to fill the row.
	// Use the measured container width (window width includes the scrollbar on web, cutting off the last column).
	const [gridWidth, setGridWidth] = useState(0);
	const layoutWidth = gridWidth || width;
	const GRID_GAP = 12;
	const MIN_CARD_WIDTH = isTablet ? 220 : 160;
	const numColumns = Math.max(2, Math.floor((layoutWidth - 32 + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)));
	const cardWidth = (layoutWidth - 32 - (numColumns - 1) * GRID_GAP) / numColumns;

	const categories = useMemo(() => {
		const cats = [...new Set(products.map((p) => p.category))];
		return ["All", ...cats];
	}, [products]);

	const filtered = products
		.filter((p) => activeCategory === "All" || p.category === activeCategory)
		.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
		.sort((a, b) => {
			const aNotif = !!a.requiresConfirmation;
			const bNotif = !!b.requiresConfirmation;
			if (aNotif !== bNotif) return aNotif ? -1 : 1;
			if (aNotif && bNotif) return 0; // preserve original order for notification products
			return a.stock - b.stock; // low stock first for the rest
		});

	const cartTotal = cart.reduce((sum, item) => sum + cartItemTotal(item), 0);
	const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
	const addOnsPreviewTotal =
		selectedAddOns.reduce((sum, a) => sum + a.price * (a.quantity ?? 1), 0);
	const itemPreviewTotal =
		(selected?.price ?? 0) * quantity + addOnsPreviewTotal;

	useEffect(() => {
		seedSampleProducts();
		const unsubscribe = subscribeToProducts(setProducts);
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const unsubscribe = subscribeToStoreStatus(setIsStoreOpen);
		return () => unsubscribe();
	}, []);

	function toggleAddOn(addOn: AddOn) {
		setSelectedAddOns((prev) =>
			prev.some((a) => a.name === addOn.name)
				? prev.filter((a) => a.name !== addOn.name)
				: [...prev, { ...addOn, quantity: 1 }],
		);
	}

	function adjustAddOnQty(addOn: AddOn, delta: number) {
		setSelectedAddOns((prev) =>
			prev.map((a) =>
				a.name === addOn.name
					? { ...a, quantity: Math.max(1, (a.quantity ?? 1) + delta) }
					: a,
			),
		);
	}

	function openModal(item: Product) {
		if (item.stock === 0) return;
		if (!isStoreOpen && item.requiresConfirmation) {
			if (Platform.OS === 'web') window.alert('This item is only available when the store is open.');
			else Alert.alert('Store Closed', 'This item is only available when the store is open.');
			return;
		}
		const existing = cart.find((c) => c.product.id === item.id);
		setSelected(item);
		setQuantity(existing?.quantity ?? 1);
		setSelectedAddOns(existing?.addOns ?? []);
	}

	function addToCart() {
		if (!selected) return;
		setCart((prev) => {
			const idx = prev.findIndex((c) => c.product.id === selected.id);
			if (idx !== -1) {
				const updated = [...prev];
				updated[idx] = { ...updated[idx], quantity, addOns: selectedAddOns };
				return updated;
			}
			return [
				...prev,
				{
					cartId: `${selected.id}-${Date.now()}`,
					product: selected,
					quantity,
					addOns: selectedAddOns,
				},
			];
		});
		setSelected(null);
	}

	function removeFromCart(cartId: string) {
		setCart((prev) => prev.filter((c) => c.cartId !== cartId));
	}

	function addCustomToCart() {
		const price = parseFloat(customPrice);
		if (!customName.trim()) {
			Alert.alert("Error", "Please enter a product name.");
			return;
		}
		if (!price || price <= 0) {
			Alert.alert("Error", "Please enter a valid price.");
			return;
		}
		const customProduct: Product = {
			id: `custom-${Date.now()}`,
			name: customName.trim(),
			price,
			image: "",
			description: "Custom order",
			category: "Custom",
			stock: 999,
		};
		setCart((prev) => [
			...prev,
			{
				cartId: `custom-${Date.now()}`,
				product: customProduct,
				quantity: 1,
				addOns: [],
				isCustom: true,
			},
		]);
		setCustomName("");
		setCustomPrice("");
		setCustomModalVisible(false);
	}

	function incrementCart(productId: string) {
		setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: Math.min(c.product.stock, c.quantity + 1) } : c));
	}

	function decrementCart(productId: string) {
		setCart(prev => {
			const item = prev.find(c => c.product.id === productId);
			if (!item) return prev;
			if (item.quantity <= 1) return prev.filter(c => c.product.id !== productId);
			return prev.map(c => c.product.id === productId ? { ...c, quantity: c.quantity - 1 } : c);
		});
	}

	function addDirectToCart(product: Product) {
		setCart(prev => {
			const existing = prev.find(c => c.product.id === product.id);
			if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: Math.min(c.product.stock, c.quantity + 1) } : c);
			return [...prev, { cartId: `${product.id}-${Date.now()}`, product, quantity: 1, addOns: [] }];
		});
	}

	async function handlePlaceOrder() {
		if (!user || cart.length === 0) return;
		if (!isStoreOpen && cart.some((c) => c.product.requiresConfirmation)) {
			if (Platform.OS === "web") window.alert("Some items in your cart require the store to be open. Please remove them or wait for the store to open.");
			else
				Alert.alert(
					"Store Closed",
					"Some items in your cart require the store to be open. Please remove them or wait for the store to open.",
				);
			return;
		}
		setLoading(true);
		try {
			for (const item of cart) {
				await createOrder(
					user.uid,
					user.email ?? "",
					item.product,
					item.quantity,
					item.addOns,
					note,
					item.isCustom ?? false,
					paymentStatus,
					unpaidReason,
				);
			}
			const count = cart.length;
			setCart([]);
			setNote("");
			setCashInput("");
			setPaymentStatus("cash");
			setUnpaidReason("");
			setCartVisible(false);
			setSuccessCount(count);
			setSuccessVisible(true);
		} catch (e: any) {
			if (Platform.OS === "web") window.alert(e.message);
			else Alert.alert("Error", e.message);
		} finally {
			setLoading(false);
		}
	}

	const username = user?.email?.split("@")[0] ?? "";

	const listHeader = (
		<>
			{/* Header */}
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Our Menu</Text>
					<Text style={styles.subtitle}>Hi, {username} 👋</Text>
				</View>
				<View style={styles.headerRight}>
					<Pressable
						style={styles.customBtn}
						onPress={() => setCustomModalVisible(true)}
					>
						<Text style={styles.customBtnText}>+ Custom</Text>
					</Pressable>
					<Pressable
						style={styles.cartBtn}
						onPress={() => setCartVisible(true)}
					>
						<Text style={styles.cartIcon}>🛒</Text>
						{cartCount > 0 && (
							<View style={styles.cartBadge}>
								<Text style={styles.cartBadgeText}>
									{cartCount > 9 ? "9+" : cartCount}
								</Text>
							</View>
						)}
					</Pressable>
				</View>
			</View>

			{/* Closed banner */}
			{!isStoreOpen && (
				<View style={styles.closedBanner}>
					<Text style={styles.closedBannerText}>
						🔒 Store is closed — items marked 🔔 are unavailable
					</Text>
				</View>
			)}

			{/* Search bar */}
			<View style={styles.searchBar}>
				<Text style={styles.searchIcon}>🔍</Text>
				<TextInput
					style={styles.searchInput}
					placeholder="Search menu..."
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

			{/* Category filter */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.filterRow}
				style={{ flexGrow: 0 }}
			>
				{categories.map((cat) => (
					<Pressable
						key={cat}
						style={[
							styles.filterBtn,
							activeCategory === cat && styles.filterBtnActive,
						]}
						onPress={() => setActiveCategory(cat)}
					>
						<Text
							style={[
								styles.filterText,
								activeCategory === cat && styles.filterTextActive,
							]}
						>
							{cat}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</>
	);

	return (
		<View
			style={styles.container}
			onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
		>
			{/* Product grid */}
			<FlatList
				data={filtered}
				keyExtractor={(item) => item.id}
				numColumns={numColumns}
				key={numColumns}
				contentContainerStyle={styles.list}
				columnWrapperStyle={styles.gridRow}
				ListHeaderComponent={listHeader}
				keyboardShouldPersistTaps="handled"
				renderItem={({ item }) => {
					const inCartItem = cart.find((c) => c.product.id === item.id);
					const inCart = !!inCartItem;
					const outOfStock = item.stock === 0;
					const hasAddOns = item.addOns && item.addOns.length > 0;
					const storeClosed = !isStoreOpen && !!item.requiresConfirmation;
					return (
						<Pressable
							style={({ pressed }) => [
								styles.card,
								{ width: cardWidth },
								(outOfStock || storeClosed) && styles.cardUnavailable,
								!outOfStock && !storeClosed && pressed && styles.cardPressed,
							]}
							onPress={() => openModal(item)}
							disabled={outOfStock}
						>
							{/* Card body */}
							<View style={styles.cardBody}>
								{/* Category overline */}
								<Text
									style={[
										styles.cardCategory,
										{ color: outOfStock ? C.muted2 : C.amber },
									]}
								>
									{item.category}
								</Text>

								{/* Name */}
								<Text
									style={[
										styles.cardName,
										outOfStock && styles.cardNameUnavailable,
									]}
									numberOfLines={2}
								>
									{item.name}
								</Text>

								{/* Stock row */}
								{!outOfStock && (
									<View style={styles.stockRow}>
										<View
											style={[
												styles.stockDot,
												{ backgroundColor: C.green },
											]}
										/>
										<Text style={styles.stockText}>{item.stock} left</Text>
									</View>
								)}

								{outOfStock ? (
									<View style={styles.unavailableBadge}>
										<Text style={styles.unavailableText}>Not Available</Text>
									</View>
								) : (
									/* Price + action row */
									<View style={styles.cardPriceRow}>
										<Text style={styles.cardPrice}>
											₱{item.price.toFixed(2)}
										</Text>

										{!inCart ? (
											/* + button */
											<Pressable
												style={({ pressed }) => [
													styles.cardAddBtn,
													pressed && styles.cardAddBtnPressed,
												]}
												onPress={() => {
													if (hasAddOns) {
														openModal(item);
													} else {
														addDirectToCart(item);
													}
												}}
											>
												<Text style={styles.cardAddBtnText}>+</Text>
											</Pressable>
										) : (
											/* Inline stepper */
											<View style={styles.stepperRow}>
												<Pressable
													style={styles.stepperBtn}
													onPress={() => decrementCart(item.id)}
												>
													<Text style={styles.stepperMinusText}>−</Text>
												</Pressable>
												<Text style={styles.stepperQty}>
													{inCartItem.quantity}
												</Text>
												<Pressable
													style={[styles.stepperBtn, styles.stepperBtnPlus]}
													onPress={() => {
														if (hasAddOns) {
															openModal(item);
														} else {
															incrementCart(item.id);
														}
													}}
												>
													<Text style={styles.stepperPlusText}>+</Text>
												</Pressable>
											</View>
										)}
									</View>
								)}
							</View>
						</Pressable>
					);
				}}
			/>

			{/* Product Detail Modal */}
			<Modal visible={!!selected} transparent animationType="slide">
				<View style={styles.overlay}>
					<ScrollView>
						<View style={[styles.modal, isTablet && styles.modalTablet]}>
							<View
								style={[
									styles.modalHeader,
									{
										backgroundColor: C.amber + "0D",
										borderBottomColor: C.amber + "22",
									},
								]}
							>
								<Text style={styles.modalCategory}>
									{selected?.category}
								</Text>
								<Text style={styles.modalTitle}>{selected?.name}</Text>
								<Text style={styles.modalPrice}>
									₱{selected?.price.toFixed(2)}
								</Text>
							</View>

							<View style={styles.modalBody}>
								<Text style={styles.modalDesc}>{selected?.description}</Text>

								{(selected?.addOns ?? []).length > 0 && (
									<View style={styles.section}>
										<Text style={styles.sectionLabel}>Add-ons</Text>
										{(selected?.addOns ?? []).map((addOn) => {
											const selectedAddOn = selectedAddOns.find(
												(a) => a.name === addOn.name,
											);
											const isActive = !!selectedAddOn;
											const addOnQty = selectedAddOn?.quantity ?? 1;
											return (
												<View
													key={addOn.name}
													style={[
														styles.addOnRow,
														isActive && styles.addOnRowActive,
													]}
												>
													<Pressable
														style={styles.addOnRowTop}
														onPress={() => toggleAddOn(addOn)}
													>
														<View
															style={[
																styles.checkbox,
																isActive && styles.checkboxActive,
															]}
														>
															{isActive && (
																<Text style={styles.checkmark}>✓</Text>
															)}
														</View>
														<Text style={styles.addOnName}>{addOn.name}</Text>
														<Text style={styles.addOnPrice}>
															+₱{(addOn.price * (isActive ? addOnQty : 1)).toFixed(2)}
														</Text>
													</Pressable>
													{isActive && (
														<View style={styles.addOnQtyRow}>
															<Text style={styles.addOnQtyLabel}>Qty</Text>
															<View style={styles.addOnQtyStepper}>
																<Pressable
																	style={styles.addOnQtyBtn}
																	onPress={() => adjustAddOnQty(addOn, -1)}
																>
																	<Text style={styles.addOnQtyBtnText}>−</Text>
																</Pressable>
																<Text style={styles.addOnQtyValue}>{addOnQty}</Text>
																<Pressable
																	style={styles.addOnQtyBtn}
																	onPress={() => adjustAddOnQty(addOn, 1)}
																>
																	<Text style={styles.addOnQtyBtnText}>+</Text>
																</Pressable>
															</View>
														</View>
													)}
												</View>
											);
										})}
									</View>
								)}

								<View style={styles.section}>
									<Text style={styles.sectionLabel}>Quantity</Text>
									<View style={styles.qtyRow}>
										<Pressable
											style={styles.qtyBtn}
											onPress={() => setQuantity((q) => Math.max(1, q - 1))}
										>
											<Text style={styles.qtyBtnText}>−</Text>
										</Pressable>
										<Text style={styles.qtyValue}>{quantity}</Text>
										<Pressable
											style={[
												styles.qtyBtn,
												quantity >= (selected?.stock ?? 0) &&
													styles.qtyBtnDisabled,
											]}
											onPress={() =>
												setQuantity((q) =>
													Math.min(selected?.stock ?? 1, q + 1),
												)
											}
											disabled={quantity >= (selected?.stock ?? 0)}
										>
											<Text style={styles.qtyBtnText}>+</Text>
										</Pressable>
									</View>
								</View>

								{/* Price preview */}
								<View style={styles.totalBox}>
									<View style={styles.totalRow}>
										<Text style={styles.totalLabel}>Base price</Text>
										<Text style={styles.totalValue}>
											₱{((selected?.price ?? 0) * quantity).toFixed(2)}
										</Text>
									</View>
									{addOnsPreviewTotal > 0 && (
										<View style={styles.totalRow}>
											<Text style={styles.totalLabel}>Add-ons</Text>
											<Text style={styles.totalValue}>
												+₱{addOnsPreviewTotal.toFixed(2)}
											</Text>
										</View>
									)}
									<View style={styles.divider} />
									<View style={styles.totalRow}>
										<Text style={styles.grandTotalLabel}>Item Total</Text>
										<Text style={styles.grandTotalValue}>
											₱{itemPreviewTotal.toFixed(2)}
										</Text>
									</View>
								</View>

								<Pressable
									style={({ pressed }) => [
										styles.addToCartBtn,
										pressed && styles.cardPressed,
									]}
									onPress={addToCart}
								>
									<Text style={styles.addToCartText}>Add to Cart</Text>
								</Pressable>

								<Pressable onPress={() => setSelected(null)}>
									<Text style={styles.cancelText}>Cancel</Text>
								</Pressable>
							</View>
						</View>
					</ScrollView>
				</View>
			</Modal>

			{/* Cart Modal */}
			<Modal visible={cartVisible} transparent animationType="slide">
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.overlay}>
						<View
							style={[
								styles.modal,
								styles.cartModal,
								isTablet && styles.modalTablet,
							]}
						>
							<View style={styles.cartHeader}>
								<View>
									<Text style={styles.cartTitle}>My Cart</Text>
									<Text style={styles.cartSubtitle}>
										{cartCount} item{cartCount !== 1 ? "s" : ""}
									</Text>
								</View>
								<Pressable
									onPress={() => setCartVisible(false)}
									style={styles.closeBtn}
								>
									<Text style={styles.closeBtnText}>✕</Text>
								</Pressable>
							</View>

							{cart.length === 0 ? (
								<View style={styles.cartEmpty}>
									<Text style={styles.cartEmptyIcon}>🛒</Text>
									<Text style={styles.cartEmptyText}>Your cart is empty</Text>
									<Pressable onPress={() => setCartVisible(false)}>
										<Text style={styles.cartEmptyLink}>Browse products</Text>
									</Pressable>
								</View>
							) : (
								<ScrollView
									showsVerticalScrollIndicator={false}
									contentContainerStyle={styles.cartList}
								>
									{cart.map((item) => {
										const total = cartItemTotal(item);
										return (
											<View
												key={item.cartId}
												style={[styles.cartItem, { borderLeftColor: C.amber }]}
											>
												<View style={styles.cartItemInfo}>
													<Text style={[styles.cartItemCategory, { color: C.amber }]}>
														{item.product.category}
													</Text>
													<Text style={styles.cartItemName} numberOfLines={1}>
														{item.product.name}
													</Text>
													{item.isCustom && (
														<View style={styles.cartItemCustomBadge}>
															<Text style={styles.cartItemCustomText}>
																CUSTOM
															</Text>
														</View>
													)}
													{item.addOns.length > 0 && (
														<Text style={styles.cartItemAddOns}>
															{item.addOns
																.map((a) => ((a.quantity ?? 1) > 1 ? `${a.quantity}× ${a.name}` : a.name))
																.join(", ")}
														</Text>
													)}
													<Text style={styles.cartItemQty}>
														Qty: {item.quantity}
													</Text>
												</View>
												<View style={styles.cartItemRight}>
													<Text style={styles.cartItemTotal}>
														₱{total.toFixed(2)}
													</Text>
													<Pressable
														onPress={() => removeFromCart(item.cartId)}
														style={styles.removeBtn}
													>
														<Text style={styles.removeBtnText}>Remove</Text>
													</Pressable>
												</View>
											</View>
										);
									})}

									<View style={styles.grandTotalBox}>
										<View style={styles.totalRow}>
											<Text style={styles.grandTotalLabel}>Grand Total</Text>
											<Text style={styles.grandTotalValue}>
												₱{cartTotal.toFixed(2)}
											</Text>
										</View>
									</View>

									{/* Cash Change Calculator */}
									{(() => {
										const cash = parseFloat(cashInput) || 0;
										const change = cash - cartTotal;
										return (
											<View style={styles.cashBox}>
												<Text style={styles.sectionLabel}>Cash Calculator</Text>
												<View style={styles.cashInputRow}>
													<Text style={styles.cashSign}>₱</Text>
													<TextInput
														style={styles.cashInput}
														placeholder="Enter cash amount"
														placeholderTextColor={C.muted2}
														value={cashInput}
														onChangeText={setCashInput}
														keyboardType="decimal-pad"
													/>
												</View>
												{cash > 0 && (
													<View
														style={[
															styles.changeRow,
															{
																backgroundColor:
																	change >= 0 ? C.green + "1A" : C.coral + "1A",
															},
														]}
													>
														<Text style={styles.changeLabel}>
															{change >= 0 ? "Change" : "Short"}
														</Text>
														<Text
															style={[
																styles.changeValue,
																{ color: change >= 0 ? C.green : C.coral },
															]}
														>
															₱{Math.abs(change).toFixed(2)}
														</Text>
													</View>
												)}
											</View>
										);
									})()}

									<View style={styles.section}>
										<Text style={styles.sectionLabel}>Note (optional)</Text>
										<TextInput
											style={styles.noteInput}
											placeholder="e.g. no onions, extra rice..."
											placeholderTextColor={C.muted2}
											value={note}
											onChangeText={setNote}
											multiline
											numberOfLines={3}
										/>
									</View>

									{/* Payment method */}
									<View style={styles.paymentSection}>
										<Text style={styles.sectionLabel}>Payment Method</Text>
										<View style={styles.paymentRadioRow}>
											{([
												{ key: 'cash',   label: 'Cash',     color: C.green },
												{ key: 'gcash',  label: 'GCash',    color: C.blue  },
												{ key: 'unpaid', label: 'Not Paid', color: C.coral },
											] as const).map((opt) => (
												<Pressable
													key={opt.key}
													style={[styles.paymentRadio, paymentStatus === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
													onPress={() => setPaymentStatus(opt.key)}
												>
													<View style={[styles.radioCircle, paymentStatus === opt.key && { borderColor: opt.color }]}>
														{paymentStatus === opt.key && <View style={[styles.radioDot, { backgroundColor: opt.color }]} />}
													</View>
													<Text style={[styles.paymentRadioText, paymentStatus === opt.key && { color: opt.color, fontFamily: F.bold }]}>
														{opt.label}
													</Text>
												</Pressable>
											))}
										</View>
										{paymentStatus === "unpaid" && (
											<TextInput
												style={styles.unpaidReasonInput}
												placeholder="Reason (e.g. will pay later, credit...)"
												placeholderTextColor={C.muted2}
												value={unpaidReason}
												onChangeText={setUnpaidReason}
											/>
										)}
									</View>

									<Pressable
										style={({ pressed }) => [
											styles.placeOrderBtn,
											paymentStatus === "unpaid" && styles.placeOrderBtnUnpaid,
											((!isStoreOpen && cart.some(c => c.product.requiresConfirmation)) || loading) && styles.placeOrderBtnDisabled,
											pressed && styles.cardPressed,
										]}
										onPress={handlePlaceOrder}
										disabled={loading || (!isStoreOpen && cart.some(c => c.product.requiresConfirmation))}
									>
										<Text style={styles.placeOrderText}>
											{loading
												? "Placing Orders..."
												: (!isStoreOpen && cart.some(c => c.product.requiresConfirmation))
													? "🔒 Remove closed items"
													: paymentStatus === "unpaid"
														? `Place Order (Unpaid) · -₱${cartTotal.toFixed(2)}`
														: paymentStatus === "gcash"
															? `Place Order (GCash) · ₱${cartTotal.toFixed(2)}`
															: `Place Order (Cash) · ₱${cartTotal.toFixed(2)}`}
										</Text>
									</Pressable>
								</ScrollView>
							)}
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Custom Item Modal */}
			<Modal visible={customModalVisible} transparent animationType="slide">
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.overlay}>
						<View style={[styles.modal, isTablet && styles.modalTablet]}>
							<View style={styles.cartHeader}>
								<View>
									<Text style={styles.cartTitle}>Custom Order</Text>
									<Text style={styles.cartSubtitle}>
										Item not on the list? Add it manually
									</Text>
								</View>
								<Pressable
									onPress={() => {
										setCustomModalVisible(false);
										setCustomName("");
										setCustomPrice("");
									}}
									style={styles.closeBtn}
								>
									<Text style={styles.closeBtnText}>✕</Text>
								</Pressable>
							</View>

							<View style={styles.customForm}>
								<View style={styles.section}>
									<Text style={styles.sectionLabel}>Product Name</Text>
									<TextInput
										style={styles.customInput}
										placeholder="Name of the food or drink"
										placeholderTextColor={C.muted2}
										value={customName}
										onChangeText={setCustomName}
										autoCapitalize="words"
									/>
								</View>

								<View style={styles.section}>
									<Text style={styles.sectionLabel}>Price (₱)</Text>
									<View style={styles.customPriceRow}>
										<Text style={styles.customPriceSign}>₱</Text>
										<TextInput
											style={styles.customPriceInput}
											placeholder="0.00"
											placeholderTextColor={C.muted2}
											value={customPrice}
											onChangeText={setCustomPrice}
											keyboardType="decimal-pad"
										/>
									</View>
								</View>

								{customName.trim() !== "" && parseFloat(customPrice) > 0 && (
									<View style={styles.customPreview}>
										<Text style={styles.customPreviewName}>
											{customName.trim()}
										</Text>
										<Text style={styles.customPreviewPrice}>
											₱{parseFloat(customPrice).toFixed(2)}
										</Text>
									</View>
								)}

								<Pressable
									style={({ pressed }) => [
										styles.addToCartBtn,
										pressed && styles.cardPressed,
									]}
									onPress={addCustomToCart}
								>
									<Text style={styles.addToCartText}>Add to Cart</Text>
								</Pressable>

								<Pressable
									onPress={() => {
										setCustomModalVisible(false);
										setCustomName("");
										setCustomPrice("");
									}}
								>
									<Text style={styles.cancelText}>Cancel</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<OrderSuccessModal
				visible={successVisible}
				count={successCount}
				onDismiss={() => setSuccessVisible(false)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },

	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 60,
		paddingBottom: 16,
	},
	title: { color: C.text, fontSize: 28, fontFamily: F.extraBold, letterSpacing: -0.5 },
	subtitle: { color: C.muted, fontSize: 13.5, fontFamily: F.medium },
	headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
	cartBtn: { position: "relative", padding: 4 },
	cartIcon: { fontSize: 26 },
	cartBadge: {
		position: "absolute",
		top: -2,
		right: -4,
		backgroundColor: C.coral,
		borderRadius: 10,
		minWidth: 18,
		height: 18,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
	},
	cartBadgeText: { color: "#fff", fontSize: 10, fontFamily: F.extraBold },

	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface,
		borderRadius: R.input,
		borderWidth: 1,
		borderColor: C.line,
		marginHorizontal: 16,
		marginBottom: 8,
		paddingHorizontal: 12,
	},
	searchIcon: { fontSize: 15, marginRight: 8 },
	searchInput: {
		flex: 1,
		color: C.text,
		fontSize: 14,
		fontFamily: F.medium,
		paddingVertical: 12,
	},
	searchClear: { color: C.muted2, fontSize: 16, padding: 4 },

	closedBanner: {
		backgroundColor: C.coral + "1A",
		borderWidth: 1,
		borderColor: C.coral + "55",
		marginHorizontal: 16,
		marginBottom: 8,
		borderRadius: R.btn,
		padding: 12,
	},
	closedBannerText: {
		color: C.coral,
		fontSize: 13,
		fontFamily: F.semiBold,
		textAlign: "center",
	},

	filterRow: {
		paddingHorizontal: 16,
		paddingBottom: 14,
		gap: 8,
		flexDirection: "row",
		alignItems: "center",
	},
	filterBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: R.chip,
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
		alignSelf: "flex-start",
	},
	filterBtnActive: { backgroundColor: C.amber, borderColor: C.amber },
	filterText: { color: C.muted2, fontSize: 13, fontFamily: F.bold },
	filterTextActive: { color: "#0f0e0d" },

	list: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 4 },
	gridRow: { gap: 12, marginBottom: 12 },

	card: {
		backgroundColor: C.surface,
		borderRadius: R.card,
		borderWidth: 1,
		borderColor: C.line,
		overflow: "hidden",
	},
	cardPressed: { transform: [{ scale: 0.97 }] },
	cardUnavailable: { opacity: 0.35 },
	cardNameUnavailable: { color: C.muted2 },
	unavailableBadge: {
		backgroundColor: C.surface2,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		alignSelf: "flex-start",
	},
	unavailableText: { color: C.muted2, fontSize: 11, fontFamily: F.bold },

	cardBody: { padding: 14, gap: 6, flex: 1 },
	cardCategory: {
		fontSize: 11.5,
		fontFamily: F.bold,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	cardName: {
		color: C.text,
		fontSize: 16,
		fontFamily: F.extraBold,
		letterSpacing: -0.3,
		lineHeight: 22,
		minHeight: 44, // reserve 2 lines so stock/price rows align across cards
	},
	stockRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: C.green + "1A",
		borderWidth: 1,
		borderColor: C.green + "40",
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
		alignSelf: "flex-start",
	},
	stockDot: { width: 7, height: 7, borderRadius: 3.5 },
	stockText: { color: C.green, fontSize: 12.5, fontFamily: F.bold },

	cardPriceRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: "auto", // pin price + button to the card bottom
	},
	cardPrice: { color: C.amber, fontSize: 18, fontFamily: F.extraBold },

	cardAddBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: C.amber,
		justifyContent: "center",
		alignItems: "center",
	},
	cardAddBtnPressed: { transform: [{ scale: 0.97 }] },
	cardAddBtnText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 20, lineHeight: 20, includeFontPadding: false },

	stepperRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface2,
		borderRadius: 999,
		paddingHorizontal: 2,
		gap: 2,
	},
	stepperBtn: {
		width: 30,
		height: 30,
		borderRadius: 15,
		justifyContent: "center",
		alignItems: "center",
	},
	stepperBtnPlus: { backgroundColor: C.amber },
	stepperQty: {
		color: C.text,
		fontFamily: F.extraBold,
		fontSize: 14,
		minWidth: 24,
		textAlign: "center",
	},
	stepperMinusText: { color: C.text, fontFamily: F.extraBold, fontSize: 18 },
	stepperPlusText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },

	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.85)",
		justifyContent: "flex-end",
	},
	modal: {
		backgroundColor: C.surface,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		overflow: "hidden",
	},
	cartModal: { maxHeight: "90%" },
	modalTablet: { marginHorizontal: 80, borderRadius: 24, marginBottom: 40 },
	modalHeader: {
		padding: 20,
		paddingBottom: 18,
		borderBottomWidth: 1,
		gap: 4,
	},
	modalCategory: {
		fontSize: 11,
		fontFamily: F.extraBold,
		textTransform: "uppercase",
		letterSpacing: 1,
		color: C.amber,
	},
	modalTitle: { color: C.text, fontSize: 24, fontFamily: F.extraBold },
	modalPrice: {
		color: C.amber,
		fontSize: 20,
		fontFamily: F.extraBold,
		marginTop: 4,
	},
	modalBody: { padding: 20, gap: 16 },
	modalDesc: { color: C.muted, fontSize: 13, lineHeight: 20, fontFamily: F.medium },

	section: { gap: 8 },
	sectionLabel: {
		color: C.muted2,
		fontSize: 11,
		fontFamily: F.bold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},

	addOnRow: {
		gap: 10,
		backgroundColor: C.surface2,
		padding: 12,
		borderRadius: R.btn,
		borderWidth: 1,
		borderColor: C.line,
	},
	addOnRowActive: { borderColor: C.amber, backgroundColor: C.amber + "0D" },
	addOnRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
	addOnQtyRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderTopWidth: 1,
		borderTopColor: C.line,
		paddingTop: 10,
	},
	addOnQtyLabel: { color: C.muted2, fontSize: 11, fontFamily: F.bold, textTransform: "uppercase", letterSpacing: 0.5 },
	addOnQtyStepper: { flexDirection: "row", alignItems: "center", gap: 10 },
	addOnQtyBtn: {
		width: 28,
		height: 28,
		borderRadius: 8,
		backgroundColor: C.surface3,
		justifyContent: "center",
		alignItems: "center",
	},
	addOnQtyBtnText: { color: C.text, fontSize: 16, fontFamily: F.semiBold },
	addOnQtyValue: { color: C.text, fontSize: 15, fontFamily: F.extraBold, minWidth: 20, textAlign: "center" },
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: C.muted2,
		justifyContent: "center",
		alignItems: "center",
	},
	checkboxActive: { backgroundColor: C.amber, borderColor: C.amber },
	checkmark: { color: "#0f0e0d", fontSize: 12, fontFamily: F.extraBold },
	addOnName: { color: C.text, fontSize: 14, fontFamily: F.medium, flex: 1 },
	addOnPrice: { color: C.amber, fontSize: 14, fontFamily: F.bold },

	qtyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
	qtyBtn: {
		backgroundColor: C.surface2,
		width: 42,
		height: 42,
		borderRadius: 12,
		justifyContent: "center",
		alignItems: "center",
	},
	qtyBtnDisabled: { opacity: 0.3 },
	qtyBtnText: { color: C.text, fontSize: 22, fontFamily: F.semiBold },
	qtyValue: {
		color: C.text,
		fontSize: 22,
		fontFamily: F.extraBold,
		minWidth: 32,
		textAlign: "center",
	},

	totalBox: {
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		borderWidth: 1,
		borderColor: C.line,
		padding: 14,
		gap: 10,
	},
	totalRow: { flexDirection: "row", justifyContent: "space-between" },
	totalLabel: { color: C.muted2, fontSize: 14, fontFamily: F.medium },
	totalValue: { color: C.muted, fontSize: 14, fontFamily: F.medium },
	divider: { height: 1, backgroundColor: C.line },
	grandTotalLabel: { color: C.text, fontSize: 16, fontFamily: F.extraBold },
	grandTotalValue: { color: C.amber, fontSize: 20, fontFamily: F.extraBold },

	noteInput: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		padding: 12,
		color: C.text,
		fontSize: 14,
		fontFamily: F.medium,
		height: 80,
		textAlignVertical: "top",
		borderWidth: 1,
		borderColor: C.line,
	},

	addToCartBtn: {
		backgroundColor: C.amber,
		padding: 16,
		borderRadius: R.btn,
		alignItems: "center",
	},
	addToCartText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },
	cancelText: {
		color: C.muted2,
		textAlign: "center",
		fontSize: 14,
		fontFamily: F.medium,
		paddingVertical: 10,
	},

	cartHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		padding: 20,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: C.line,
	},
	cartTitle: { color: C.text, fontSize: 22, fontFamily: F.extraBold },
	cartSubtitle: { color: C.muted, fontSize: 13, fontFamily: F.medium, marginTop: 2 },
	closeBtn: {
		backgroundColor: C.surface2,
		width: 32,
		height: 32,
		borderRadius: 16,
		justifyContent: "center",
		alignItems: "center",
	},
	closeBtnText: { color: C.muted, fontSize: 14, fontFamily: F.bold },

	cartEmpty: {
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
		paddingVertical: 60,
	},
	cartEmptyIcon: { fontSize: 48, color: C.muted2 },
	cartEmptyText: { color: C.muted, fontSize: 16, fontFamily: F.medium },
	cartEmptyLink: { color: C.amber, fontSize: 14, fontFamily: F.semiBold },

	cartList: { padding: 16, gap: 12, paddingBottom: 40 },
	cartItem: {
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		padding: 14,
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 12,
		borderLeftWidth: 4,
	},
	cartItemInfo: { flex: 1, gap: 3 },
	cartItemCategory: {
		fontSize: 10,
		fontFamily: F.extraBold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	cartItemName: { color: C.text, fontSize: 15, fontFamily: F.bold },
	cartItemAddOns: { color: C.muted, fontSize: 12, fontFamily: F.medium },
	cartItemQty: { color: C.muted2, fontSize: 12, fontFamily: F.medium },
	cartItemRight: {
		alignItems: "flex-end",
		gap: 8,
		justifyContent: "space-between",
	},
	cartItemTotal: { color: C.green, fontSize: 16, fontFamily: F.extraBold },
	removeBtn: {
		backgroundColor: C.coral + "1A",
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
	},
	removeBtnText: { color: C.coral, fontSize: 12, fontFamily: F.bold },

	grandTotalBox: { backgroundColor: C.surface2, borderRadius: R.btn, padding: 16 },

	cashBox: {
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		padding: 14,
		gap: 10,
	},
	cashInputRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface2,
		borderRadius: R.input,
		paddingHorizontal: 12,
	},
	cashSign: {
		color: C.amber,
		fontSize: 20,
		fontFamily: F.bold,
		marginRight: 4,
	},
	cashInput: {
		flex: 1,
		color: C.text,
		fontSize: 22,
		fontFamily: F.extraBold,
		paddingVertical: 10,
	},
	changeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderRadius: R.input,
		padding: 12,
	},
	changeLabel: { color: C.muted2, fontSize: 15, fontFamily: F.bold },
	changeValue: { fontSize: 22, fontFamily: F.extraBold },

	placeOrderBtn: {
		backgroundColor: C.amber,
		padding: 16,
		borderRadius: R.btn,
		alignItems: "center",
	},
	placeOrderBtnUnpaid: { backgroundColor: C.coral },
	placeOrderBtnDisabled: { backgroundColor: C.surface2, opacity: 1 },
	placeOrderText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },

	paymentSection: { gap: 8 },
	paymentRadioRow: { flexDirection: "row", gap: 10 },
	paymentRadio: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		borderWidth: 1,
		borderColor: C.line,
		padding: 12,
	},
	paymentRadioPaid:   { borderColor: C.green,  backgroundColor: C.green  + "1A" },
	paymentRadioUnpaid: { borderColor: C.coral,  backgroundColor: C.coral  + "1A" },
	radioCircle: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 2,
		borderColor: C.muted2,
		justifyContent: "center",
		alignItems: "center",
	},
	radioCirclePaid:   { borderColor: C.green },
	radioCircleUnpaid: { borderColor: C.coral },
	radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.text },
	paymentRadioText: { color: C.muted, fontFamily: F.medium, fontSize: 14 },
	unpaidReasonInput: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		borderWidth: 1,
		borderColor: C.coral + "59",
		padding: 12,
		color: C.text,
		fontFamily: F.medium,
		fontSize: 14,
	},

	customBtn: {
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.amber,
		borderRadius: R.chip,
		paddingHorizontal: 14,
		paddingVertical: 7,
	},
	customBtnText: { color: C.amber, fontSize: 13, fontFamily: F.bold },

	customForm: { padding: 20, gap: 16 },
	customInput: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		padding: 14,
		color: C.text,
		fontSize: 15,
		fontFamily: F.medium,
		borderWidth: 1,
		borderColor: C.line,
	},
	customPriceRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface2,
		borderRadius: R.input,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: C.line,
	},
	customPriceSign: {
		color: C.amber,
		fontSize: 20,
		fontFamily: F.bold,
		marginRight: 6,
	},
	customPriceInput: {
		flex: 1,
		color: C.text,
		fontSize: 24,
		fontFamily: F.bold,
		paddingVertical: 12,
	},
	customPreview: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: C.green + "0D",
		borderRadius: R.input,
		padding: 14,
		borderWidth: 1,
		borderColor: C.green + "33",
	},
	customPreviewName: {
		color: C.text,
		fontSize: 15,
		fontFamily: F.semiBold,
		flex: 1,
	},
	customPreviewPrice: { color: C.green, fontSize: 18, fontFamily: F.extraBold },

	cartItemCustomBadge: {
		backgroundColor: C.surface2,
		borderRadius: 4,
		paddingHorizontal: 6,
		paddingVertical: 2,
		alignSelf: "flex-start",
	},
	cartItemCustomText: { color: C.muted, fontSize: 10, fontFamily: F.bold },
});
