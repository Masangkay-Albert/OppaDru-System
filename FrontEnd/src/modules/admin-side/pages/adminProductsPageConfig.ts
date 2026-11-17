import type { ProductPageAdapter, ProductsPageConfig } from '../../shared/components/ProductsPage';
import {
  addProduct,
  archiveProduct,
  deleteProduct,
  getAllProducts,
  getArchivedProducts,
  restoreProduct,
  toggleAvailability,
  updateProduct,
} from '../../../services/adminProductService';
import { productService } from '../../../services/productService';
import { getFranchises } from '../../../services/franchiseAdminService';

const adminProductAdapter: ProductPageAdapter = {
  list: getAllProducts,
  listArchived: getArchivedProducts,
  create: addProduct,
  update: async (id, changes, imageFile) => updateProduct(id, changes, imageFile),
  toggleAvailability: async (product) => toggleAvailability(product.id),
  archive: archiveProduct,
  restore: restoreProduct,
  delete: deleteProduct,
  uploadImage: (file, category) => productService.uploadImage(file, category),
};

const adminProductsPageConfig: ProductsPageConfig = {
  subtitle: 'Manage your menu items and availability.',
  adapter: adminProductAdapter,
  scopeBranches: async () => (await getFranchises()).map((branch) => ({
    id: String(branch.id),
    name: branch.name,
  })),
  permissions: {
    add: true,
    bulkAvailability: true,
    bulkCategory: true,
    bulkDelete: true,
    forProduct: () => true,
  },
};

export default adminProductsPageConfig;
