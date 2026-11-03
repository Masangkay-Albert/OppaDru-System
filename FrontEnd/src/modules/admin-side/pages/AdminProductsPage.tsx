import React from 'react';
import AdminLayout from '../components/AdminLayout';
import ProductsPage from '../../shared/components/ProductsPage';
import adminProductsPageConfig from './adminProductsPageConfig';

const AdminProductsPage: React.FC = () => (
  <AdminLayout>
    <ProductsPage config={adminProductsPageConfig} />
  </AdminLayout>
);

export default AdminProductsPage;
