import React, { useEffect, useRef, useState } from 'react';
import { Archive, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, Image as ImageIcon, ImagePlus, LayoutGrid, List, PackageOpen, PlusSquare, Search, Trash2, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllProducts, toggleAvailability, deleteProduct, updateProduct, addProduct } from '../../../services/adminProductService';
import { productService } from '../../../services/productService';
import type { Product, ProductCategory } from '../../../types/product.types';
import { formatCurrency } from '../../../utils/formatters';
import { categories } from '../../../data/mockData';
import { AvailabilitySwitch, ConfirmDialog, EmptyState, PageHeader, RowActionsMenu, Toast } from '../components/AdminUI';

const categoryOptions: Array<{ value: ProductCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  ...categories.filter((c) => c.id !== 'all').map((c) => ({ value: c.id, label: c.name })),
];
type ProductFormState = {
  name: string;
  description: string;
  price: string;
  category: ProductCategory;
  image: string;
  isAvailable: boolean;
};

const ProductImage: React.FC<{ src?: string; name: string; className?: string }> = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const image = src && src !== '/oppadrulogo.jpg' && !failed;
  return (
    <span className={`group/image relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] ${className}`}>
      {image
        ? <img src={src} alt={name} onError={() => setFailed(true)} className="size-full object-cover" />
        : <ImageIcon size={21} aria-label={`${name} placeholder image`} />}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 bg-black/65 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/image:opacity-100 group-focus-within/image:opacity-100">
        <ImagePlus size={13} aria-hidden="true" /> Add photo
      </span>
    </span>
  );
};

const createEmptyForm = (): ProductFormState => ({
  name: '',
  description: '',
  price: '',
  category: 'chicken',
  image: '',
  isAvailable: true,
});

const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState('');
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [sortBy, setSortBy] = useState<'category' | 'name' | 'price' | 'newest'>('category');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('adminArchivedProducts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [categoryTabsOverflow, setCategoryTabsOverflow] = useState(false);
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const mobileSelectAllRef = useRef<HTMLInputElement>(null);
  const [pendingAvailability, setPendingAvailability] = useState<string[]>([]);

  const isAvailable = (product: Product) => product.isAvailable ?? product.is_available;
  const isArchived = (product: Product) => archivedIds.includes(product.id);

  const updateArchivedIds = (nextIds: string[]) => {
    setArchivedIds(nextIds);
    localStorage.setItem('adminArchivedProducts', JSON.stringify(nextIds));
  };

  const refresh = async () => {
    try {
      const result = await getAllProducts();
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const getCategoryLabel = (category: string) => {
    return categories.find((item) => item.id === category)?.name || category.replace('-', ' ');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredProducts = products
    .filter((product) => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      const matchesArchiveStatus = isArchived(product) === showArchived;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(product.name || '').toLowerCase().includes(normalizedSearch) ||
        String(product.description || '').toLowerCase().includes(normalizedSearch) ||
        getCategoryLabel(product.category).toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesArchiveStatus && matchesSearch;
    })
    .sort((a, b) => {
      const result = sortBy === 'price'
        ? Number(a.price) - Number(b.price)
        : sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : sortBy === 'newest'
            ? new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            : a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return result * (sortDirection === 'asc' ? 1 : -1);
    });
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.includes(product.id));
  const someVisibleSelected = visibleProducts.some((product) => selectedIds.includes(product.id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    if (mobileSelectAllRef.current) mobileSelectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  useEffect(() => {
    const tabs = categoryTabsRef.current;
    if (!tabs) return;
    const updateOverflow = () => setCategoryTabsOverflow(tabs.scrollWidth > tabs.clientWidth + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [products]);

  const scrollCategoryTabs = (direction: -1 | 1) => {
    categoryTabsRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  const handleToggle = async (id: string) => {
    const current = products.find((product) => product.id === id);
    if (!current || pendingAvailability.includes(id)) return;
    const nextAvailability = !isAvailable(current);
    setProducts((currentProducts) => currentProducts.map((product) => product.id === id
      ? { ...product, is_available: nextAvailability, isAvailable: nextAvailability }
      : product));
    setPendingAvailability((currentIds) => [...currentIds, id]);
    try {
      await toggleAvailability(id);
      await refresh();
      setActionError('');
      setToastMessage(nextAvailability ? 'Marked as available' : 'Marked as unavailable');
    } catch (error) {
      console.error('Failed to update product availability:', error);
      setProducts((currentProducts) => currentProducts.map((product) => product.id === id
        ? { ...product, is_available: !nextAvailability, isAvailable: !nextAvailability }
        : product));
      setActionError('Could not update product availability.');
    } finally {
      setPendingAvailability((currentIds) => currentIds.filter((productId) => productId !== id));
    }
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const handleBulkAvailability = async (available: boolean) => {
    const targets = products.filter((product) => selectedIds.includes(product.id) && isAvailable(product) !== available);
    setProducts((currentProducts) => currentProducts.map((product) => selectedIds.includes(product.id)
      ? { ...product, is_available: available, isAvailable: available }
      : product));
    try {
      for (const product of targets) await toggleAvailability(product.id);
      await refresh();
      setSelectedIds([]);
      setActionError('');
      setToastMessage(`Marked ${targets.length} ${targets.length === 1 ? 'product' : 'products'} as ${available ? 'available' : 'unavailable'}`);
    } catch (error) {
      console.error('Failed to update selected product availability:', error);
      setActionError('Could not update availability for the selected products.');
      await refresh();
    }
  };

  const handleBulkCategory = async (category: ProductCategory) => {
    const targets = products.filter((product) => selectedIds.includes(product.id) && product.category !== category);
    try {
      for (const product of targets) await updateProduct(product.id, { category });
      await refresh();
      setSelectedIds([]);
      setActionError('');
      setToastMessage(`Category updated for ${targets.length} ${targets.length === 1 ? 'product' : 'products'}`);
    } catch (error) {
      console.error('Failed to update selected product categories:', error);
      setActionError('Could not change the category for the selected products.');
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setProductToDelete({ id, name: product.name });
  };

  const confirmDeleteProduct = async () => {
    try {
      if (productToDelete) await deleteProduct(productToDelete.id);
      else if (confirmBulkDelete) {
        for (const id of selectedIds) await deleteProduct(id);
      } else return;
      await refresh();
      setSelectedIds([]);
      setPage(1);
      setActionError('');
      setToastMessage(productToDelete ? 'Product deleted' : 'Selected products deleted');
      updateArchivedIds(archivedIds.filter((id) => !selectedIds.includes(id) && id !== productToDelete?.id));
    } catch (error) {
      console.error('Failed to delete product:', error);
      setActionError('Could not delete the selected product(s).');
    } finally {
      setProductToDelete(null);
      setConfirmBulkDelete(false);
    }
  };

  const duplicateProduct = async (product: Product) => {
    try {
      await addProduct({
        name: `${product.name} (copy)`,
        description: product.description,
        price: product.price,
        category: product.category as ProductCategory,
        image: product.image,
        is_available: isAvailable(product),
        isAvailable: isAvailable(product),
      });
      await refresh();
      setToastMessage('Product duplicated');
    } catch (error) {
      console.error('Failed to duplicate product:', error);
      setActionError('Could not duplicate this product.');
    }
  };

  const toggleArchive = (product: Product) => {
    const next = isArchived(product)
      ? archivedIds.filter((id) => id !== product.id)
      : [...archivedIds, product.id];
    updateArchivedIds(next);
    setToastMessage(isArchived(product) ? 'Product restored' : 'Product archived');
  };

  const actionItems = (product: Product) => [
    { label: 'Delete product', destructive: true, onSelect: () => void handleDelete(product.id) },
    { label: isArchived(product) ? 'Restore product' : 'Archive product', onSelect: () => toggleArchive(product) },
    { label: 'View details', onSelect: () => setDetailsProduct(product) },
  ];

  const openAddModal = () => {
    setModalMode('add');
    setSelectedProductId(null);
    setForm(createEmptyForm());
    setImagePreview('');
    setSelectedFile(null);
    setSaveError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setModalMode('edit');
    setSelectedProductId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      category: product.category as ProductCategory,
      image: product.image || '',
      isAvailable: product.isAvailable ?? product.is_available,
    });
    setImagePreview(product.image || '');
    setSelectedFile(null);
    setSaveError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProductId(null);
    setForm(createEmptyForm());
    setImagePreview('');
    setSelectedFile(null);
    setSaveError('');
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setImagePreview(form.image);
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError('');

    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        category: form.category,
        is_available: form.isAvailable,
        isAvailable: form.isAvailable,
      };

      if (modalMode === 'edit' && selectedProductId) {
        const image = selectedFile
          ? await productService.uploadImage(selectedFile, form.category)
          : undefined;
        await updateProduct(selectedProductId, { ...payload, ...(image ? { image } : {}) });
      } else {
        const image = selectedFile
          ? await productService.uploadImage(selectedFile, form.category)
          : form.image;
        await addProduct({ ...payload, image });
      }

      closeModal();
      await refresh();
    } catch (error) {
      console.error('Failed to save product:', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to save the product.');
    }
  };

  return (
    <AdminLayout>
      <div className="-mx-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-4 pb-3 pt-1 sm:-mx-6 sm:px-6">
        <PageHeader title="Products" subtitle="Manage your menu items and availability." actions={
          <button
            type="button"
            onClick={openAddModal}
            className="bg-oppa-gradient inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <PlusSquare size={16} /> Add Product
          </button>
        } />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full shrink-0 lg:max-w-xs lg:flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
            <input
              aria-label="Search products"
              type="text"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
              placeholder="Search products..."
              className="h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] py-2 pl-9 pr-3 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              {categoryTabsOverflow && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[var(--oppa-cream)] to-transparent" />}
              {categoryTabsOverflow && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--oppa-cream)] to-transparent" />}
              {categoryTabsOverflow && <button type="button" aria-label="Scroll categories left" onClick={() => scrollCategoryTabs(-1)} className="absolute left-0 top-1/2 z-20 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-sm hover:bg-[var(--oppa-green-soft)]"><ChevronLeft size={15} /></button>}
              <div ref={categoryTabsRef} onScroll={() => {
                const tabs = categoryTabsRef.current;
                if (tabs) setCategoryTabsOverflow(tabs.scrollWidth > tabs.clientWidth + 1);
              }} className="admin-scrollbar flex min-w-0 gap-2 overflow-x-auto py-1 [scrollbar-width:thin]">
              {categoryOptions.map((option) => {
                const count = option.value === 'all' ? products.length : products.filter((product) => product.category === option.value).length;
                return (
              <button
                type="button"
                aria-pressed={activeCategory === option.value}
                key={option.value}
                onClick={() => { setActiveCategory(option.value); setPage(1); }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === option.value
                    ? 'border-green-700 bg-green-700 text-white shadow-sm'
                    : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]'
                }`}
              >
                {option.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${activeCategory === option.value ? 'bg-white/20 text-white' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]'}`}>{count}</span>
              </button>
                );
              })}
            </div>
              {categoryTabsOverflow && <button type="button" aria-label="Scroll categories right" onClick={() => scrollCategoryTabs(1)} className="absolute right-0 top-1/2 z-20 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-sm hover:bg-[var(--oppa-green-soft)]"><ChevronRight size={15} /></button>}
            </div>
          </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" aria-pressed={showArchived} onClick={() => { setShowArchived((value) => !value); setSelectedIds([]); setPage(1); }} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${showArchived ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'}`}><Archive size={14} />{showArchived ? 'Showing archived' : `Archived (${archivedIds.length})`}</button>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="product-sort" className="whitespace-nowrap text-xs font-medium text-[var(--oppa-text-muted)]">Sort by</label>
                <select id="product-sort" value={sortBy} onChange={(event) => { const value = event.target.value as typeof sortBy; setSortBy(value); setSortDirection(value === 'newest' ? 'desc' : 'asc'); setPage(1); }} className="h-9 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]">
                  <option value="name">Name</option><option value="price">Price</option><option value="category">Category</option><option value="newest">Newest</option>
                </select>
                <button type="button" aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'} title={sortDirection === 'asc' ? 'Ascending' : 'Descending'} onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')} className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]">
                  {sortDirection === 'asc' ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>
              </div>
              <div role="group" aria-label="Product view" className="inline-flex items-center rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-0.5">
                <button type="button" aria-label="Table view" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} className={`inline-flex size-8 items-center justify-center rounded-md ${viewMode === 'table' ? 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]' : 'text-[var(--oppa-text-muted)]'}`}><List size={16} /></button>
                <button type="button" aria-label="Card view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`inline-flex size-8 items-center justify-center rounded-md ${viewMode === 'grid' ? 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]' : 'text-[var(--oppa-text-muted)]'}`}><LayoutGrid size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(productToDelete || confirmBulkDelete) && <ConfirmDialog title={productToDelete ? `Delete "${productToDelete.name}"?` : `Delete ${selectedIds.length} selected products?`} description="This action cannot be undone." confirmLabel="Delete" onCancel={() => { setProductToDelete(null); setConfirmBulkDelete(false); }} onConfirm={() => void confirmDeleteProduct()} />}
      {detailsProduct && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsProduct(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-details-title" className="w-full max-w-lg rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 id="product-details-title" className="font-serif text-xl font-semibold text-[var(--oppa-text)]">Product details</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Menu item information</p></div>
            <button type="button" aria-label="Close product details" onClick={() => setDetailsProduct(null)} className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"><X size={18} /></button>
          </div>
          <div className="flex items-center gap-4">
            <ProductImage src={detailsProduct.image} name={detailsProduct.name} className="size-16 rounded-2xl" />
            <div className="min-w-0"><h3 className="truncate font-semibold text-[var(--oppa-text)]">{detailsProduct.name}</h3><p className="text-sm text-[var(--oppa-text-muted)]">{getCategoryLabel(detailsProduct.category)}</p></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--oppa-text-muted)]">{detailsProduct.description || 'No description provided.'}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[var(--oppa-cream)] p-4 text-sm">
            <div><dt className="text-xs text-[var(--oppa-text-muted)]">Price</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]">{formatCurrency(detailsProduct.price)}</dd></div>
            <div><dt className="text-xs text-[var(--oppa-text-muted)]">Availability</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]">{isAvailable(detailsProduct) ? 'Available' : 'Unavailable'}</dd></div>
          </dl>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => { setDetailsProduct(null); openEditModal(detailsProduct); }} className="rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Edit product</button></div>
        </section>
      </div>}
      {toastMessage && <Toast key={toastMessage} message={toastMessage} onDismiss={() => setToastMessage('')} />}
      {actionError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{actionError}</p>}

      {isLoading && <div aria-label="Loading products" aria-busy="true" className="admin-card mt-4 animate-pulse space-y-3 p-5">{[0, 1, 2, 3].map((row) => <div key={row} className="admin-skeleton h-16 rounded-xl" />)}</div>}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="admin-card mt-4">
          <EmptyState icon={<PackageOpen size={23} />} title={searchTerm ? 'No products match your search' : 'No products in this category'} description={searchTerm ? 'Try another product name or clear your search.' : 'Add a product to start building your menu.'} action={<button type="button" onClick={openAddModal} className="mt-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Add product</button>} />
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && <div className={`mt-4 flex items-center gap-2 text-xs text-[var(--oppa-text-muted)] ${viewMode === 'grid' ? '' : 'md:hidden'}`}>
        <input ref={mobileSelectAllRef} type="checkbox" aria-label="Select all visible products" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleProducts.some((product) => product.id === id)) : [...new Set([...current, ...visibleProducts.map((product) => product.id)])])} className="size-4 accent-green-700" />
        <span>Select all on this page</span>
      </div>}
      {!isLoading && filteredProducts.length > 0 && (
        <div className={`mt-4 gap-3 ${viewMode === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'grid md:hidden'}`}>
          {visibleProducts.map((product) => (
            <div key={product.id} className={`admin-card group p-4 transition-colors hover:border-[var(--oppa-green)]/40 ${isAvailable(product) ? '' : 'opacity-70'}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} className="mt-4 size-4 accent-green-700" />
                <ProductImage src={product.image} name={product.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-[var(--oppa-text)]">{product.name}</p>
                    <button type="button" aria-label={`View details for ${product.name}`} onClick={() => setDetailsProduct(product)} className="rounded-md p-1 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]"><Eye size={16} /></button>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--oppa-text-muted)]">{product.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
                    <span className={`rounded-full px-2 py-1 capitalize ${activeCategory === 'all' ? 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]' : 'text-[var(--oppa-text-muted)]'}`}>{getCategoryLabel(product.category)}</span>
                    <span>•</span>
                    <span className="tabular-nums ml-auto text-right font-semibold text-[var(--oppa-text)]">{formatCurrency(product.price)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--oppa-border)] pt-3">
                <div className="inline-flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]"><AvailabilitySwitch checked={isAvailable(product)} label={`Change availability for ${product.name}`} activeText="Available" inactiveText="Unavailable" disabled={pendingAvailability.includes(product.id)} onChange={() => void handleToggle(product.id)} /><span>{isAvailable(product) ? 'Available' : 'Unavailable'}</span></div>
                <div className="flex items-center gap-1">
                  {!isArchived(product) && <>
                    <button type="button" aria-label={`Edit ${product.name}`} onClick={() => openEditModal(product)} className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--oppa-text-muted)] opacity-100 hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">Edit</button>
                    <button type="button" aria-label={`Duplicate ${product.name}`} onClick={() => void duplicateProduct(product)} className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--oppa-text-muted)] opacity-100 hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">Duplicate</button>
                  </>}
                  <RowActionsMenu label={product.name} items={actionItems(product)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && viewMode === 'table' && (
        <div className="admin-scrollbar mt-4 hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm md:block">
          <table className="admin-table products-table w-full min-w-[780px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: '4%' }} /><col style={{ width: activeCategory === 'all' ? '34%' : '49%' }} />
              {activeCategory === 'all' && <col style={{ width: '15%' }} />}
              <col style={{ width: '12%' }} /><col style={{ width: '22%' }} /><col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
                <th scope="col" className="col-center"><input ref={selectAllRef} type="checkbox" aria-label="Select all visible products" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleProducts.some((product) => product.id === id)) : [...new Set([...current, ...visibleProducts.map((product) => product.id)])])} className="size-4 accent-green-700" /></th>
                <th scope="col" className="col-left">Item</th>
                {activeCategory === 'all' && <th scope="col" className="col-left">Category</th>}
                <th scope="col" className="col-right">Price</th>
                <th scope="col" className="col-left">Availability</th>
                <th scope="col" className="col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id} className={`group border-b border-[var(--oppa-border)]/70 last:border-0 transition-colors hover:bg-[var(--oppa-green-soft)]/45 ${isAvailable(product) ? '' : 'opacity-70'}`}>
                  <td data-label="Select" className="col-center"><input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} className="size-4 accent-green-700" /></td>
                  <td data-label="Item" className="col-left">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImage src={product.image} name={product.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--oppa-text)]">{product.name}</p>
                        <p className="truncate text-xs text-[var(--oppa-text-muted)]">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  {activeCategory === 'all' && <td data-label="Category" className="col-left"><span title={getCategoryLabel(product.category)} className="inline-block max-w-full truncate rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 align-middle text-xs font-medium capitalize text-[var(--oppa-text)]">{getCategoryLabel(product.category)}</span></td>}
                  <td data-label="Price" className="col-right tabular-nums font-semibold text-[var(--oppa-text)]">{formatCurrency(product.price)}</td>
                  <td data-label="Availability" className="col-left"><div className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-[var(--oppa-text-muted)]"><AvailabilitySwitch checked={isAvailable(product)} label={`Change availability for ${product.name}`} activeText="Available" inactiveText="Unavailable" disabled={pendingAvailability.includes(product.id)} onChange={() => void handleToggle(product.id)} /><span>{isAvailable(product) ? 'Available' : 'Unavailable'}</span></div></td>
                  <td data-label="Actions" className="col-right"><div className="flex items-center justify-end gap-1">
                    {!isArchived(product) && <>
                      <button type="button" aria-label={`Edit ${product.name}`} onClick={() => openEditModal(product)} className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--oppa-text-muted)] opacity-0 transition-opacity hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)] group-hover:opacity-100 group-focus-within:opacity-100">Edit</button>
                      <button type="button" aria-label={`Duplicate ${product.name}`} onClick={() => void duplicateProduct(product)} className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--oppa-text-muted)] opacity-0 transition-opacity hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)] group-hover:opacity-100 group-focus-within:opacity-100">Duplicate</button>
                    </>}
                    <RowActionsMenu label={product.name} items={actionItems(product)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filteredProducts.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--oppa-text-muted)]">
        <div className="flex items-center gap-3">
          <span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length}</span>
          <label className="flex items-center gap-2 text-xs">Rows
            <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-sm">
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
          </label>
        </div>
        <nav aria-label="Product pages" className="flex items-center gap-1">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 disabled:opacity-50">Prev</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, Math.min(currentPage - 2, pageCount - 3)), Math.max(0, Math.min(currentPage - 2, pageCount - 3)) + 3).map((pageNumber) => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`size-9 rounded-lg border text-sm ${currentPage === pageNumber ? 'border-green-700 bg-green-700 text-white' : 'border-[var(--oppa-border)] hover:bg-[var(--oppa-green-soft)]'}`}>{pageNumber}</button>)}
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 disabled:opacity-50">Next</button>
        </nav>
      </div>}

      <div className={`fixed bottom-5 left-1/2 z-[90] flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-3 shadow-2xl transition-all duration-200 ${selectedIds.length ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
        <span className="whitespace-nowrap text-sm font-semibold text-[var(--oppa-text)]">{selectedIds.length} selected</span>
        <button type="button" disabled={!products.some((product) => selectedIds.includes(product.id) && !isAvailable(product))} onClick={() => void handleBulkAvailability(true)} className="whitespace-nowrap rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-50">Mark available</button>
        <button type="button" disabled={!products.some((product) => selectedIds.includes(product.id) && isAvailable(product))} onClick={() => void handleBulkAvailability(false)} className="whitespace-nowrap rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] disabled:cursor-not-allowed disabled:opacity-50">Mark unavailable</button>
        <label className="sr-only" htmlFor="bulk-product-category">Change category for selected products</label>
        <select id="bulk-product-category" aria-label="Change category for selected products" defaultValue="" onChange={(event) => { if (event.target.value) void handleBulkCategory(event.target.value as ProductCategory); event.target.value = ''; }} className="h-9 max-w-36 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-xs text-[var(--oppa-text)]">
          <option value="" disabled>Change category</option>
          {categoryOptions.filter((option) => option.value !== 'all').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" onClick={() => setConfirmBulkDelete(true)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"><Trash2 size={14} />Delete</button>
        <button type="button" aria-label="Clear product selection" onClick={() => setSelectedIds([])} className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"><X size={16} /></button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">
                  {modalMode === 'add' ? 'Add Product' : 'Edit Product'}
                </h2>
                <p className="text-sm text-[var(--oppa-text-muted)]">
                  {modalMode === 'add' ? 'Create a new menu item for the shop.' : 'Update the selected product details.'}
                </p>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {saveError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Image upload failed: {saveError}</p>}

              <div>
                <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Product Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Price (₱)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ProductCategory }))}
                    className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
                  >
                    {categoryOptions.filter((option) => option.value !== 'all').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Food Image</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
                  {(imagePreview || (form.image && form.image !== '/oppadrulogo.jpg')) ? <img src={imagePreview || form.image} alt="Product preview" className="mt-3 h-28 w-full rounded-xl object-cover" /> : <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]"><ImageIcon size={32} aria-hidden="true" /></div>}
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) => setForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
                />
                Available for ordering
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-oppa-gradient rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  {modalMode === 'add' ? 'Save Product' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminProductsPage;