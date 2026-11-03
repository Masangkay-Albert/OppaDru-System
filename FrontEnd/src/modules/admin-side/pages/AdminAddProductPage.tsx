import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { addProduct } from '../../../services/adminProductService';
import { categories } from '../../../data/mockData';
import { productService } from '../../../services/productService';
import { getFranchises } from '../../../services/franchiseAdminService';
import type { ProductCategory } from '../../../types/product.types';
import Select from '../../../components/ui/Select';

const categoryOptions = categories
  .filter((category) => category.id !== 'all')
  .map((category) => ({ value: category.id as ProductCategory, label: category.name }));

const GLOBAL_PRODUCT_SCOPE = '__global__';

const AdminAddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'chicken' as ProductCategory,
    image: '',
    franchiseId: GLOBAL_PRODUCT_SCOPE,
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getFranchises().then((items) => {
      if (!cancelled) {
        setBranches(items.map((branch) => ({ id: String(branch.id), name: branch.name })));
        setBranchesError('');
      }
    }).catch((error: unknown) => {
      console.error('Failed to load product scope branches:', error);
      if (!cancelled) setBranchesError('Could not load branches. Product scope is unavailable.');
    }).finally(() => {
      if (!cancelled) setBranchesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setImagePreview('');
      setForm((prev) => ({ ...prev, image: '' }));
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveError('');

    try {
      let imageUrl = '/oppadrulogo.jpg';

      if (selectedFile) {
        imageUrl = await productService.uploadImage(selectedFile, form.category);
      }

      await addProduct({
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        category: form.category,
        image: imageUrl,
        is_available: true,
        isAvailable: true,
        franchise_id: form.franchiseId === GLOBAL_PRODUCT_SCOPE ? null : form.franchiseId,
      });

      setSuccess(true);
      setTimeout(() => navigate('/admin/products'), 900);
    } catch (error) {
      console.error('Failed to add product:', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to add the product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Add Product</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Create a new menu item for the shop.</p>
      </div>

      {success && (
        <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700">
          Product added successfully!
        </div>
      )}

      {saveError && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Image upload failed: {saveError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Product Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Price (₱)</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            />
          </div>
          <div>
            <Select
              label="Category"
              value={form.category}
              onChange={(category) => setForm({ ...form, category })}
              options={categoryOptions}
            />
          </div>
        </div>
        {branchesError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{branchesError}</p>}
        <Select
          label="Scope"
          aria-label="Product scope"
          value={form.franchiseId}
          onChange={(franchiseId) => setForm((current) => ({ ...current, franchiseId }))}
          options={[
            { value: GLOBAL_PRODUCT_SCOPE, label: 'All branches (global)' },
            ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
          disabled={branchesLoading || Boolean(branchesError)}
        />

        <div>
          <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Food Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm"
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Product preview"
              className="mt-3 h-32 w-full rounded-lg border border-[var(--oppa-border)] object-cover"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || branchesLoading || Boolean(branchesError)}
          className="bg-oppa-gradient rounded-lg px-5 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Product'}
        </button>
      </form>
    </AdminLayout>
  );
};

export default AdminAddProductPage;