// src/modules/admin-side/pages/AdminProductsPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusSquare, Trash2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllProducts, toggleAvailability, deleteProduct } from '../../../services/adminProductService';
import type { Product } from '../../../types/product.types';
import { formatCurrency } from '../../../utils/formatters';

const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);

  const refresh = () => setProducts(getAllProducts());

  useEffect(() => {
    refresh();
  }, []);

  const handleToggle = (id: string) => {
    toggleAvailability(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (!id.startsWith('custom-')) return; // only admin-added products can be removed
    deleteProduct(id);
    refresh();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          to="/admin/products/add"
          className="flex items-center gap-2 bg-lime-700 hover:bg-lime-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <PlusSquare size={16} /> Add Product
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-gray-400 text-xs">{product.description}</p>
                </td>
                <td className="px-5 py-3 capitalize text-gray-600">{product.category.replace('-', ' ')}</td>
                <td className="px-5 py-3 font-medium">{formatCurrency(product.price)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.isAvailable ? 'Available' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(product.id)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Toggle Stock
                    </button>
                    {product.id.startsWith('custom-') && (
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete product"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminProductsPage;
