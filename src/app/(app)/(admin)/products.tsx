import { useEffect, useState } from "react";
import {
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

import {
  type AddOn,
  type Product,
  addProduct,
  deleteProduct,
  subscribeToAllProducts,
  updateProduct,
} from "@/lib/products";
import { C, F, R } from "@/lib/theme";

const EMPTY_FORM = { name: "", price: "", image: "", category: "", stock: "" };
const EMPTY_ADDON = { name: "", price: "" };
const PRODUCTS_PAGE_SIZE = 10;

const FIELDS = [
	{
		key: "name",
		label: "Name",
		placeholder: "e.g. Burger Meal",
		required: true,
	},
	{
		key: "price",
		label: "Price",
		placeholder: "e.g. 150.00",
		required: true,
		keyboardType: "numeric",
	},
	{
		key: "category",
		label: "Category",
		placeholder: "e.g. Meals, Drinks, Snacks",
		required: true,
	},
	{
		key: "stock",
		label: "Stock",
		placeholder: "e.g. 50",
		required: false,
		keyboardType: "numeric",
	},
];

export default function AdminProductsScreen() {
	const [products, setProducts] = useState<Product[]>([]);
	const [modalVisible, setModalVisible] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [addOns, setAddOns] = useState<AddOn[]>([]);
	const [addOnForm, setAddOnForm] = useState(EMPTY_ADDON);
	const [requiresConfirmation, setRequiresConfirmation] = useState(false);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState("All");
	const [productPage, setProductPage] = useState(0);
	const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
	const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
	const [newCategoryInput, setNewCategoryInput] = useState("");
	const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
	const { width } = useWindowDimensions();
	const isTablet = width >= 768;
	const numColumns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;

	useEffect(() => {
		const unsubscribe = subscribeToAllProducts(setProducts);
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		setProductPage(0);
	}, [search, activeCategory]);

	function openAdd() {
		setEditingProduct(null);
		setForm(EMPTY_FORM);
		setAddOns([]);
		setAddOnForm(EMPTY_ADDON);
		setRequiresConfirmation(false);
		setModalVisible(true);
	}

	function openEdit(product: Product) {
		setEditingProduct(product);
		setForm({
			name: product.name,
			price: String(product.price),
			image: product.image,
			category: product.category,
			stock: String(product.stock),
		});
		setAddOns(product.addOns ?? []);
		setAddOnForm(EMPTY_ADDON);
		setRequiresConfirmation(product.requiresConfirmation ?? false);
		setModalVisible(true);
	}

	function addAddOn() {
		if (!addOnForm.name || !addOnForm.price) return;
		setAddOns((prev) => [
			...prev,
			{ name: addOnForm.name.trim(), price: parseFloat(addOnForm.price) },
		]);
		setAddOnForm(EMPTY_ADDON);
	}

	function removeAddOn(index: number) {
		setAddOns((prev) => prev.filter((_, i) => i !== index));
	}

	function closeModal() {
		setModalVisible(false);
		setForm(EMPTY_FORM);
		setEditingProduct(null);
		setAddOns([]);
		setCategoryPickerVisible(false);
		setNewCategoryInput("");
		setShowNewCategoryInput(false);
	}

	function adjustStockDraft(id: string, currentStock: number, delta: number) {
		setStockDrafts((prev) => ({
			...prev,
			[id]: Math.max(0, (prev[id] ?? currentStock) + delta),
		}));
	}

	async function saveStockDraft(product: Product) {
		const newStock = stockDrafts[product.id];
		if (newStock === undefined) return;
		try {
			await updateProduct(product.id, { ...product, stock: newStock });
			setStockDrafts((prev) => {
				const next = { ...prev };
				delete next[product.id];
				return next;
			});
		} catch (e: any) {
			alert(e.message);
		}
	}

	function confirmDelete(product: Product) {
		if (Platform.OS === "web") {
			if (window.confirm(`Delete "${product.name}"? This cannot be undone.`))
				deleteProduct(product.id);
		} else {
			deleteProduct(product.id);
		}
	}

	async function handleSubmit() {
		if (!form.name || !form.price || !form.category) {
			alert("Name, price and category are required.");
			return;
		}
		setLoading(true);
		try {
			const data = {
				name: form.name.trim(),
				price: parseFloat(form.price),
				image:
					form.image.trim() ||
					`https://picsum.photos/seed/${Date.now()}/400/300`,
				category: form.category.trim(),
				stock: parseInt(form.stock) || 0,
				requiresConfirmation,
				addOns,
			};
			if (editingProduct) {
				await updateProduct(editingProduct.id, data);
			} else {
				await addProduct(data);
			}
			closeModal();
		} catch (e: any) {
			alert(e.message);
		} finally {
			setLoading(false);
		}
	}

	const allCategories = [
		"All",
		...Array.from(new Set(products.map((p) => p.category))),
	];
	const existingCategories = Array.from(
		new Set(products.map((p) => p.category)),
	)
		.filter(Boolean)
		.sort();
	const displayed = products
		.filter((p) => activeCategory === "All" || p.category === activeCategory)
		.filter(
			(p) =>
				!search ||
				p.name.toLowerCase().includes(search.toLowerCase()) ||
				p.category.toLowerCase().includes(search.toLowerCase()),
		)
		.sort((a, b) => {
			if (a.name === "Pancit Canton") return -1;
			if (b.name === "Pancit Canton") return 1;
			return b.stock - a.stock;
		});

	const productTotalPages = Math.max(
		1,
		Math.ceil(displayed.length / PRODUCTS_PAGE_SIZE),
	);
	const productPageClamped = Math.min(productPage, productTotalPages - 1);
	const pagedProducts = displayed.slice(
		productPageClamped * PRODUCTS_PAGE_SIZE,
		productPageClamped * PRODUCTS_PAGE_SIZE + PRODUCTS_PAGE_SIZE,
	);

	const listHeader = (
		<>
			{/* Header */}
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Products</Text>
					<Text style={styles.subtitle}>
						{products.length} item{products.length !== 1 ? "s" : ""}
					</Text>
				</View>
				<Pressable
					style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
					onPress={openAdd}
				>
					<Text style={styles.addBtnText}>+ Add</Text>
				</Pressable>
			</View>

			{/* Search bar */}
			<View style={styles.searchBar}>
				<Text style={styles.searchIcon}>🔍</Text>
				<TextInput
					style={styles.searchInput}
					placeholder="Search by name or category..."
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
				{allCategories.map((cat) => (
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
		<View style={styles.container}>
			{/* Product list */}
			<FlatList
				data={pagedProducts}
				keyExtractor={(item) => item.id}
				key={numColumns}
				numColumns={numColumns}
				columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
				contentContainerStyle={styles.list}
				ListHeaderComponent={listHeader}
				keyboardShouldPersistTaps="handled"
				ListEmptyComponent={
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No products found</Text>
					</View>
				}
				ListFooterComponent={
					displayed.length > PRODUCTS_PAGE_SIZE ? (
						<View style={styles.pagination}>
							<Pressable
								disabled={productPageClamped === 0}
								onPress={() =>
									setProductPage(Math.max(0, productPageClamped - 1))
								}
								style={({ pressed }) => [
									styles.pageBtn,
									productPageClamped === 0 && styles.pageBtnDisabled,
									pressed && productPageClamped > 0 && { opacity: 0.7 },
								]}
							>
								<Text style={styles.pageBtnText}>Prev</Text>
							</Pressable>
							<Text style={styles.pageIndicator}>
								{productPageClamped + 1} / {productTotalPages}
							</Text>
							<Pressable
								disabled={productPageClamped >= productTotalPages - 1}
								onPress={() =>
									setProductPage(
										Math.min(productTotalPages - 1, productPageClamped + 1),
									)
								}
								style={({ pressed }) => [
									styles.pageBtn,
									productPageClamped >= productTotalPages - 1 &&
										styles.pageBtnDisabled,
									pressed &&
										productPageClamped < productTotalPages - 1 && {
											opacity: 0.7,
										},
								]}
							>
								<Text style={styles.pageBtnText}>Next</Text>
							</Pressable>
						</View>
					) : null
				}
				renderItem={({ item }) => {
					const draft = stockDrafts[item.id] ?? item.stock;
					const isDirty =
						stockDrafts[item.id] !== undefined &&
						stockDrafts[item.id] !== item.stock;
					const inStock = item.stock > 0;
					return (
						<View style={numColumns > 1 ? styles.gridItem : undefined}>
							<View
								style={[
									styles.card,
									{ borderLeftColor: inStock ? C.green : C.coral },
								]}
							>
								{/* Top: image + info + stock badge */}
								<Pressable
									style={({ pressed }) => [
										styles.cardTop,
										pressed && styles.cardPressed,
									]}
									onPress={() => openEdit(item)}
								>
									<View style={styles.cardImage}>
										<Text style={styles.cardImageLetter}>
											{item.name.charAt(0).toUpperCase()}
										</Text>
									</View>
									<View style={styles.cardInfo}>
										<Text style={styles.cardName} numberOfLines={1}>
											{item.name}
										</Text>
										<View style={styles.cardMetaRow}>
											<Text style={styles.cardCategory}>{item.category}</Text>
											{(item.addOns ?? []).length > 0 && (
												<View style={styles.addOnsBadge}>
													<Text style={styles.addOnsBadgeText}>
														+{item.addOns!.length}
													</Text>
												</View>
											)}
											{item.requiresConfirmation && (
												<Text style={styles.notifyBadgeText}>🔔</Text>
											)}
										</View>
										<Text style={styles.cardPrice}>
											₱{item.price.toFixed(2)}
										</Text>
									</View>
									<View
										style={[
											styles.stockBadge,
											{
												backgroundColor: inStock
													? C.green + "22"
													: C.coral + "22",
												borderColor: inStock ? C.green + "55" : C.coral + "55",
											},
										]}
									>
										<Text
											style={[
												styles.stockBadgeText,
												{ color: inStock ? C.green : C.coral },
											]}
										>
											{item.stock} left
										</Text>
									</View>
								</Pressable>

								{/* Divider */}
								<View style={styles.cardDivider} />

								{/* Bottom: stepper + edit/delete + save */}
								<View style={styles.stockRow}>
									<Pressable
										style={({ pressed }) => [
											styles.qtyBtn,
											pressed && { opacity: 0.7 },
										]}
										onPress={() => adjustStockDraft(item.id, item.stock, -1)}
									>
										<Text style={styles.qtyBtnText}>−</Text>
									</Pressable>
									<Text style={styles.qtyValue}>{draft}</Text>
									<Pressable
										style={({ pressed }) => [
											styles.qtyBtn,
											pressed && { opacity: 0.7 },
										]}
										onPress={() => adjustStockDraft(item.id, item.stock, 1)}
									>
										<Text style={styles.qtyBtnText}>+</Text>
									</Pressable>

									<View style={{ flex: 1 }} />

									<Pressable
										style={({ pressed }) => [
											styles.editBtn,
											pressed && styles.pressed,
										]}
										onPress={() => openEdit(item)}
									>
										<Text style={styles.editBtnText}>✎</Text>
									</Pressable>
									<Pressable
										style={({ pressed }) => [
											styles.deleteBtn,
											pressed && styles.pressed,
										]}
										onPress={() => confirmDelete(item)}
									>
										<Text style={styles.deleteBtnText}>✕</Text>
									</Pressable>

									{isDirty && (
										<Pressable
											style={({ pressed }) => [
												styles.qtySaveBtn,
												pressed && { opacity: 0.7 },
											]}
											onPress={() => saveStockDraft(item)}
										>
											<Text style={styles.qtySaveBtnText}>Save</Text>
										</Pressable>
									)}
								</View>
							</View>
						</View>
					);
				}}
			/>

			{/* Add / Edit Modal */}
			<Modal visible={modalVisible} transparent animationType="slide">
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<View style={[styles.overlay, { justifyContent: "flex-end" }]}>
						<View style={[styles.modal, isTablet && styles.modalTablet]}>
							<View style={styles.modalTitleRow}>
								<Text style={styles.modalTitle}>
									{editingProduct ? "Edit Product" : "New Product"}
								</Text>
								<Pressable onPress={closeModal} style={styles.closeBtn}>
									<Text style={styles.closeBtnText}>✕</Text>
								</Pressable>
							</View>

							<ScrollView
								showsVerticalScrollIndicator={false}
								contentContainerStyle={styles.form}
								keyboardShouldPersistTaps="handled"
							>
								{FIELDS.map((field) => {
									if (field.key === "category") {
										return (
											<View key="category" style={styles.fieldGroup}>
												<Text style={styles.fieldLabel}>
													Category<Text style={styles.required}> *</Text>
												</Text>
												<Pressable
													style={({ pressed }) => [
														styles.catPickerBtn,
														pressed && styles.pressed,
													]}
													onPress={() => {
														setShowNewCategoryInput(false);
														setNewCategoryInput("");
														setCategoryPickerVisible(true);
													}}
												>
													<Text
														style={[
															styles.catPickerBtnText,
															!form.category && { color: C.muted2 },
														]}
													>
														{form.category || "Select a category..."}
													</Text>
													<Text style={styles.catChevron}>›</Text>
												</Pressable>
											</View>
										);
									}
									return (
										<View key={field.key} style={styles.fieldGroup}>
											<Text style={styles.fieldLabel}>
												{field.label}
												{field.required && (
													<Text style={styles.required}> *</Text>
												)}
											</Text>
											<TextInput
												style={[
													styles.input,
													(field as any).multiline && styles.inputMultiline,
												]}
												placeholder={field.placeholder}
												placeholderTextColor={C.muted2}
												value={form[field.key as keyof typeof EMPTY_FORM]}
												onChangeText={(val) =>
													setForm((f) => ({ ...f, [field.key]: val }))
												}
												keyboardType={(field as any).keyboardType ?? "default"}
												multiline={(field as any).multiline}
												autoCapitalize="none"
											/>
										</View>
									);
								})}

								{/* Order Notification */}
								<Pressable
									style={styles.checkRow}
									onPress={() => setRequiresConfirmation((v) => !v)}
								>
									<View
										style={[
											styles.checkbox,
											requiresConfirmation && styles.checkboxChecked,
										]}
									>
										{requiresConfirmation && (
											<Text style={styles.checkMark}>✓</Text>
										)}
									</View>
									<View style={styles.checkTextGroup}>
										<Text style={styles.checkLabel}>Notify on order</Text>
										<Text style={styles.checkHint}>
											Admin gets an alert when this product is ordered
										</Text>
									</View>
								</Pressable>

								{/* Add-ons */}
								<View style={styles.fieldGroup}>
									<Text style={styles.fieldLabel}>Add-ons</Text>

									{addOns.map((a, i) => (
										<View key={i} style={styles.addOnItem}>
											<Text style={styles.addOnItemName}>{a.name}</Text>
											<Text style={styles.addOnItemPrice}>
												₱{a.price.toFixed(2)}
											</Text>
											<Pressable
												onPress={() => removeAddOn(i)}
												style={styles.removeBtn}
											>
												<Text style={styles.removeBtnText}>✕</Text>
											</Pressable>
										</View>
									))}

									<View style={styles.addOnInputRow}>
										<TextInput
											style={[styles.input, { flex: 2 }]}
											placeholder="Add-on name"
											placeholderTextColor={C.muted2}
											value={addOnForm.name}
											onChangeText={(v) =>
												setAddOnForm((f) => ({ ...f, name: v }))
											}
											autoCapitalize="none"
										/>
										<TextInput
											style={[styles.input, { flex: 1 }]}
											placeholder="Price"
											placeholderTextColor={C.muted2}
											value={addOnForm.price}
											onChangeText={(v) =>
												setAddOnForm((f) => ({ ...f, price: v }))
											}
											keyboardType="numeric"
										/>
										<Pressable style={styles.addOnAddBtn} onPress={addAddOn}>
											<Text style={styles.addOnAddBtnText}>+</Text>
										</Pressable>
									</View>
								</View>

								<Pressable
									style={({ pressed }) => [
										styles.submitBtn,
										pressed && styles.pressed,
									]}
									onPress={handleSubmit}
									disabled={loading}
								>
									<Text style={styles.submitText}>
										{loading
											? "Saving..."
											: editingProduct
												? "Save Changes"
												: "Add Product"}
									</Text>
								</Pressable>
							</ScrollView>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Category Picker Bottom Sheet */}
			<Modal visible={categoryPickerVisible} transparent animationType="slide">
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<View style={[styles.overlay, { justifyContent: "flex-end" }]}>
						<Pressable
							style={{ flex: 1 }}
							onPress={() => setCategoryPickerVisible(false)}
						/>
						<View
							style={[styles.catPickerSheet, isTablet && styles.modalTablet]}
						>
							<View style={styles.modalTitleRow}>
								<Text style={styles.modalTitle}>Select Category</Text>
								<Pressable
									onPress={() => setCategoryPickerVisible(false)}
									style={styles.closeBtn}
								>
									<Text style={styles.closeBtnText}>✕</Text>
								</Pressable>
							</View>

							<ScrollView
								showsVerticalScrollIndicator={false}
								keyboardShouldPersistTaps="handled"
							>
								{existingCategories.map((cat) => (
									<Pressable
										key={cat}
										style={({ pressed }) => [
											styles.catOption,
											pressed && styles.pressed,
										]}
										onPress={() => {
											setForm((f) => ({ ...f, category: cat }));
											setCategoryPickerVisible(false);
										}}
									>
										<Text
											style={[
												styles.catOptionText,
												form.category === cat && styles.catOptionTextActive,
											]}
										>
											{cat}
										</Text>
										{form.category === cat && (
											<Text style={styles.catOptionCheck}>✓</Text>
										)}
									</Pressable>
								))}

								{!showNewCategoryInput ? (
									<Pressable
										style={({ pressed }) => [
											styles.addCatRow,
											pressed && styles.pressed,
										]}
										onPress={() => setShowNewCategoryInput(true)}
									>
										<Text style={styles.addCatRowText}>+ Add category</Text>
									</Pressable>
								) : (
									<View style={styles.newCatRow}>
										<TextInput
											style={[styles.input, { flex: 1 }]}
											placeholder="Category name"
											placeholderTextColor={C.muted2}
											value={newCategoryInput}
											onChangeText={setNewCategoryInput}
											autoFocus
											autoCapitalize="words"
										/>
										<Pressable
											style={[
												styles.addOnAddBtn,
												{ paddingHorizontal: 14, width: "auto" },
											]}
											onPress={() => {
												const trimmed = newCategoryInput.trim();
												if (!trimmed) return;
												setForm((f) => ({ ...f, category: trimmed }));
												setNewCategoryInput("");
												setShowNewCategoryInput(false);
												setCategoryPickerVisible(false);
											}}
										>
											<Text style={[styles.addOnAddBtnText, { fontSize: 14 }]}>
												Add
											</Text>
										</Pressable>
									</View>
								)}
							</ScrollView>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },

	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		paddingHorizontal: 16,
		paddingTop: 60,
		paddingBottom: 16,
	},
	title: { color: C.text, fontSize: 28, fontFamily: F.extraBold },
	subtitle: {
		color: C.muted,
		fontSize: 13,
		marginTop: 2,
		fontFamily: F.medium,
	},
	addBtn: {
		backgroundColor: C.amber,
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: R.btn,
	},
	addBtnText: { color: "#0f0e0d", fontFamily: F.bold, fontSize: 14 },
	pressed: { opacity: 0.75 },
	cardPressed: { transform: [{ scale: 0.97 }] },

	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface,
		borderRadius: R.input,
		marginHorizontal: 16,
		marginBottom: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: C.line,
	},
	searchIcon: { color: C.muted2, fontSize: 16, marginRight: 8 },
	searchInput: {
		flex: 1,
		color: C.text,
		fontSize: 14,
		paddingVertical: 12,
		fontFamily: F.medium,
	},
	searchClear: { color: C.muted2, fontSize: 16, padding: 4 },

	filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
	filterBtn: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: R.chip,
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
	},
	filterBtnActive: { backgroundColor: C.amber, borderColor: C.amber },
	filterText: { color: C.muted, fontSize: 12, fontFamily: F.bold },
	filterTextActive: { color: "#0f0e0d" },

	list: { paddingHorizontal: 16, paddingBottom: 110, gap: 10, paddingTop: 4 },
	columnWrapper: { gap: 10 },
	gridItem: { flex: 1 },

	empty: { alignItems: "center", paddingVertical: 60 },
	emptyText: { color: C.muted, fontSize: 14, fontFamily: F.medium },

	pagination: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
		marginTop: 12,
		marginBottom: 100,
	},
	pageBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: C.line,
		backgroundColor: C.surface,
	},
	pageBtnDisabled: { opacity: 0.4 },
	pageBtnText: { color: C.text, fontSize: 13, fontFamily: F.bold },
	pageIndicator: { color: C.muted2, fontSize: 13, fontFamily: F.bold },

	card: {
		backgroundColor: C.surface,
		borderRadius: R.btn,
		borderLeftWidth: 4,
		borderWidth: 1,
		borderColor: C.line,
		overflow: "hidden",
	},
	cardTop: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
	cardImage: {
		width: 52,
		height: 52,
		borderRadius: 12,
		backgroundColor: C.surface2,
		justifyContent: "center",
		alignItems: "center",
	},
	cardImageLetter: { color: C.muted, fontSize: 20, fontFamily: F.extraBold },
	cardInfo: { flex: 1, gap: 3 },
	cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
	cardCategory: { color: C.muted, fontSize: 13, fontFamily: F.medium },
	cardName: { color: C.text, fontSize: 15, fontFamily: F.bold },
	cardPrice: { color: C.green, fontSize: 13, fontFamily: F.bold },
	cardMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
	},
	stockBadge: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
		borderWidth: 1,
	},
	stockBadgeText: { fontSize: 12, fontFamily: F.bold },
	cardDivider: { height: 1, backgroundColor: C.line },
	addOnsBadge: {
		backgroundColor: C.amber + "1A",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
	},
	addOnsBadgeText: { color: C.amber, fontSize: 10, fontFamily: F.bold },
	notifyBadgeText: { fontSize: 12 },

	editBtn: {
		width: 32,
		height: 32,
		backgroundColor: C.surface2,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	editBtnText: { color: C.muted, fontSize: 15 },
	deleteBtn: {
		width: 32,
		height: 32,
		backgroundColor: C.coral + "1A",
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	deleteBtnText: { color: C.coral, fontSize: 15 },

	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.85)",
		justifyContent: "flex-end",
	},
	modal: {
		backgroundColor: C.surface,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 24,
		maxHeight: "92%",
	},
	modalTablet: { marginHorizontal: 80, borderRadius: 24, marginBottom: 40 },
	modalTitleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	modalTitle: { color: C.text, fontSize: 20, fontFamily: F.extraBold },
	closeBtn: {
		backgroundColor: C.surface2,
		width: 32,
		height: 32,
		borderRadius: 16,
		justifyContent: "center",
		alignItems: "center",
	},
	closeBtnText: { color: C.muted, fontSize: 14, fontFamily: F.bold },

	form: { gap: 14, paddingBottom: 20 },
	fieldGroup: { gap: 6 },
	fieldLabel: {
		color: C.muted2,
		fontSize: 11,
		fontFamily: F.bold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	required: { color: C.coral },
	input: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		padding: 13,
		color: C.text,
		fontSize: 15,
		fontFamily: F.medium,
		borderWidth: 1,
		borderColor: C.line,
	},
	inputMultiline: { height: 80, textAlignVertical: "top" },

	addOnItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		padding: 10,
		marginBottom: 6,
		gap: 8,
		borderWidth: 1,
		borderColor: C.line,
	},
	addOnItemName: { color: C.text, flex: 1, fontSize: 14, fontFamily: F.medium },
	addOnItemPrice: { color: C.green, fontFamily: F.bold, fontSize: 14 },
	removeBtn: {
		backgroundColor: C.coral + "1A",
		width: 26,
		height: 26,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	removeBtnText: { color: C.coral, fontFamily: F.bold, fontSize: 11 },
	addOnInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
	addOnAddBtn: {
		backgroundColor: C.amber,
		width: 46,
		height: 46,
		borderRadius: R.input,
		justifyContent: "center",
		alignItems: "center",
	},
	addOnAddBtnText: { color: "#0f0e0d", fontSize: 24, fontFamily: F.semiBold },

	submitBtn: {
		backgroundColor: C.amber,
		padding: 16,
		borderRadius: R.btn,
		alignItems: "center",
		marginTop: 8,
	},
	submitText: { color: "#0f0e0d", fontFamily: F.extraBold, fontSize: 16 },

	checkRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: C.surface2,
		borderRadius: R.btn,
		padding: 14,
		borderWidth: 1,
		borderColor: C.line,
	},
	checkbox: {
		width: 24,
		height: 24,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: C.muted2,
		justifyContent: "center",
		alignItems: "center",
	},
	checkboxChecked: { backgroundColor: C.green, borderColor: C.green },
	checkMark: { color: "#fff", fontSize: 14, fontFamily: F.extraBold },
	checkTextGroup: { flex: 1, gap: 2 },
	checkLabel: { color: C.text, fontSize: 14, fontFamily: F.bold },
	checkHint: { color: C.muted2, fontSize: 12, fontFamily: F.medium },

	stockRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	qtyBtn: {
		width: 30,
		height: 30,
		borderRadius: 8,
		backgroundColor: C.surface2,
		borderWidth: 1,
		borderColor: C.line,
		justifyContent: "center",
		alignItems: "center",
	},
	qtyBtnText: { color: C.text, fontSize: 16, fontFamily: F.bold },
	qtyValue: {
		color: C.text,
		fontSize: 15,
		fontFamily: F.extraBold,
		minWidth: 24,
		textAlign: "center",
	},
	qtySaveBtn: {
		backgroundColor: C.amber,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		marginLeft: 4,
	},
	qtySaveBtnText: { color: "#0f0e0d", fontSize: 12, fontFamily: F.bold },

	catPickerBtn: {
		backgroundColor: C.surface2,
		borderRadius: R.input,
		padding: 13,
		borderWidth: 1,
		borderColor: C.line,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	catPickerBtnText: {
		color: C.text,
		fontSize: 15,
		fontFamily: F.medium,
		flex: 1,
	},
	catChevron: { color: C.muted2, fontSize: 22, marginLeft: 8 },

	catPickerSheet: {
		backgroundColor: C.surface,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 24,
		maxHeight: "70%",
	},
	catOption: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 4,
		borderBottomWidth: 1,
		borderBottomColor: C.line,
	},
	catOptionText: { color: C.text, fontSize: 15, fontFamily: F.medium, flex: 1 },
	catOptionTextActive: { color: C.amber, fontFamily: F.bold },
	catOptionCheck: { color: C.amber, fontSize: 16, fontFamily: F.bold },
	addCatRow: { paddingVertical: 16, paddingHorizontal: 4 },
	addCatRowText: { color: C.amber, fontSize: 14, fontFamily: F.bold },
	newCatRow: {
		flexDirection: "row",
		gap: 8,
		alignItems: "center",
		paddingTop: 12,
	},
});
