import type { Addon, CartItem, Product } from '../types/product.types';

const FIXED_PRICE_BEVERAGE_CATEGORIES = new Set(['fruity-soda-milk', 'fresh-lemonade']);

export const isFixedPriceBeverage = (category: string): boolean =>
  FIXED_PRICE_BEVERAGE_CATEGORIES.has(category.toLowerCase());

export const calculateProductOptionsTotal = (
  unitPrice: number,
  quantity: number,
  selectedAddons: Addon[] = [],
): number => {
  const addonsTotal = selectedAddons.reduce(
    (sum, addon) => sum + Number(addon.price || 0) * Math.max(1, Number(addon.quantity || 1)),
    0,
  );
  return (Number(unitPrice || 0) + addonsTotal) * quantity;
};

export const normalizeFixedPriceBeverageCartItem = (
  item: CartItem,
  product: Product,
): CartItem => {
  if (!isFixedPriceBeverage(product.category)) return item;

  const currentPrice = Number(product.price);
  const previousPrice = Number(item.price);
  const removedOptions = Boolean(item.selectedSize || item.selectedAddons?.length);
  const priceChanged = previousPrice !== currentPrice;
  if (!removedOptions && !priceChanged) {
    return item.cartIssue
      ? { ...item, cartIssue: undefined, currentBranchPrice: undefined }
      : item;
  }

  return {
    ...item,
    price: currentPrice,
    selectedSize: undefined,
    selectedAddons: undefined,
    cartIssue: undefined,
    currentBranchPrice: undefined,
    priceUpdateNotice: {
      previousPrice,
      currentPrice,
      removedOptions,
    },
  };
};
