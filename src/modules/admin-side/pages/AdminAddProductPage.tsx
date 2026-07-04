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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
          Product added successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Food Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {(imagePreview || form.image) && (
            <img
              src={imagePreview || form.image}
              alt="Product preview"
              className="mt-3 h-32 w-full object-cover rounded-lg border border-gray-200"
            />
          )}
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
