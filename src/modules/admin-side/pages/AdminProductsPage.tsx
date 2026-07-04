// src/modules/admin-side/pages/AdminProductsPage.tsx
import React, { useEffect, useState } from 'react';
import { PlusSquare, Search, Trash2, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllProducts, toggleAvailability, deleteProduct, updateProduct, addProduct } from '../../../services/adminProductService';
import type { Product, ProductCategory } from '../../../types/product.types';
import { formatCurrency } from '../../../utils/formatters';
import { categories } from '../../../data/mockData';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';

const categoryOptions = [{ value: 'all' as const, label: 'All' }, ...categories.filter((c) => c.id !== 'all').map((c) => ({ value: c.id as ProductCategory, label: c.name }))];
const DEFAULT_PRODUCT_IMAGE = oppaDruLogo;

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  category: ProductCategory;
  image: string;
  isAvailable: boolean;
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

  const refresh = () => setProducts(getAllProducts());

  useEffect(() => {
    refresh();
  }, []);

  const getCategoryLabel = (category: ProductCategory) => {
    return categories.find((item) => item.id === category)?.name || category.replace('-', ' ');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.description.toLowerCase().includes(normalizedSearch) ||
      getCategoryLabel(product.category).toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  const handleToggle = (id: string) => {
    toggleAvailability(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    refresh();
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedProductId(null);
    setForm(createEmptyForm());
    setImagePreview('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setModalMode('edit');
    setSelectedProductId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      category: product.category,
      image: product.image || '',
      isAvailable: product.isAvailable,
    });
    setImagePreview(product.image || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProductId(null);
    setForm(createEmptyForm());
    setImagePreview('');
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({ ...prev, image: '' }));
      setImagePreview('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setForm((prev) => ({ ...prev, image: result }));
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      category: form.category,
      image: form.image,
      isAvailable: form.isAvailable,
    };

    if (modalMode === 'edit' && selectedProductId) {
      updateProduct(selectedProductId, payload);
    } else {
      addProduct({ ...payload, isAvailable: true });
    }

    closeModal();
    refresh();
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-10 -mx-4 border-b border-gray-100 bg-gray-50/95 px-4 pb-4 pt-1 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-lime-700 px-4 py-2 text-sm font-medium text-white hover:bg-lime-800"
          >
            <PlusSquare size={16} /> Add Product
          </button>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-700"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setActiveCategory(option.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeCategory === option.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 max-h-[calc(100vh-250px)] overflow-auto rounded-2xl border border-gray-200 bg-white sm:max-h-[calc(100vh-270px)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <th className="px-5 py-3">Item</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No products found.
                </td>
              </tr>
            )}
            {filteredProducts.map((product) => (
              <tr key={product.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={product.image || DEFAULT_PRODUCT_IMAGE}
                      alt={product.name}
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                      }}
                      className="h-14 w-14 rounded-lg border border-gray-200 object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 capitalize text-gray-600">{getCategoryLabel(product.category)}</td>
                <td className="px-5 py-3 font-medium">{formatCurrency(product.price)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.isAvailable ? 'Available' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleToggle(product.id)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Toggle Stock
                    </button>
                    <button onClick={() => openEditModal(product)} className="text-xs font-medium text-amber-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700" title="Delete product">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{modalMode === 'add' ? 'Add Product' : 'Edit Product'}</h2>
                <p className="text-sm text-gray-500">
                  {modalMode === 'add' ? 'Create a new menu item for the shop.' : 'Update the selected product details.'}
                </p>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Product Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Price (₱)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ProductCategory }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
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
                <label className="mb-1 block text-sm text-gray-600">Food Image</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <img
                  src={imagePreview || form.image || DEFAULT_PRODUCT_IMAGE}
                  alt="Preview"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                  }}
                  className="mt-3 h-28 w-full rounded-lg border border-gray-200 object-cover"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) => setForm((prev) => ({ ...prev, isAvailable: event.target.checked }))}
                />
                Available for ordering
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-lime-700 px-4 py-2 text-sm font-medium text-white hover:bg-lime-800">
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
