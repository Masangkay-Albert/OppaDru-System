// src/modules/admin-side/pages/AdminAddProductPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { addProduct } from '../../../services/adminProductService';
import type { ProductCategory } from '../../../types/product.types';

const categoryOptions: ProductCategory[] = [
  'rice-meals',
  'sulit-meals',
  'chicken',
  'beverages',
  'snacks',
  'side-dishes',
];

const AdminAddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'chicken' as ProductCategory,
  });
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct({
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      category: form.category,
      image: '',
      isAvailable: true,
    });
    setSuccess(true);
    setTimeout(() => navigate('/admin/products'), 900);
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
          Product added successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Product Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Price (₱)</label>
            <input
              type="number"
              required
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c.replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="bg-lime-700 hover:bg-lime-800 text-white font-medium px-5 py-2 rounded-lg"
        >
          Save Product
        </button>
      </form>
    </AdminLayout>
  );
};

export default AdminAddProductPage;
