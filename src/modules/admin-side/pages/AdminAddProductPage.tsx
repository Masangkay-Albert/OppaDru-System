// src/modules/admin-side/pages/AdminAddProductPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { addProduct } from '../../../services/adminProductService';
import { categories } from '../../../data/mockData';
import type { ProductCategory } from '../../../types/product.types';

const categoryOptions = categories
  .filter((category) => category.id !== 'all')
  .map((category) => ({ value: category.id as ProductCategory, label: category.name }));

const AdminAddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'chicken' as ProductCategory,
    image: '',
  });
  const [imagePreview, setImagePreview] = useState('');
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct({
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      category: form.category,
      image: form.image,
      isAvailable: true,
    });
    setSuccess(true);
    setTimeout(() => navigate('/admin/products'), 900);
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Add Product</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Create a new menu item for the shop.</p>
      </div>

      {success && (
        <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700">
          Product added successfully!
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
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
              className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            >
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Food Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm"
          />
          {(imagePreview || form.image) && (
            <img
              src={imagePreview || form.image}
              alt="Product preview"
              className="mt-3 h-32 w-full rounded-lg border border-[var(--oppa-border)] object-cover"
            />
          )}
        </div>

        <button
          type="submit"
          className="bg-oppa-gradient rounded-lg px-5 py-2 font-medium text-white transition hover:opacity-90"
        >
          Save Product
        </button>
      </form>
    </AdminLayout>
  );
};

export default AdminAddProductPage;