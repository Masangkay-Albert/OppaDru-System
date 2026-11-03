import type { Product } from '../types/product.types';

export type ProductPermission = 'edit' | 'duplicate' | 'availability' | 'archive' | 'restore' | 'delete' | 'bulk-select' | 'bulk-category' | 'details';

export const canManageBranchProduct = (
  product: Product,
  permission: ProductPermission,
  branchId: string,
  canManage: boolean,
): boolean => {
  if (!canManage) return permission === 'details';
  const isInBranchCatalog = !product.franchise_id || String(product.franchise_id) === branchId;
  switch (permission) {
    case 'availability':
    case 'bulk-select':
    case 'details':
      return true;
    case 'edit':
    case 'duplicate':
    case 'archive':
    case 'restore':
    case 'delete':
    case 'bulk-category':
      return isInBranchCatalog;
  }
};
