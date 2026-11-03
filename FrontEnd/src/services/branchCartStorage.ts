import type { CartItem } from '../types/product.types';

export interface BranchCart {
  items: CartItem[];
  useCutlery: boolean;
}

export const UNASSIGNED_BRANCH = '__unassigned__';
export const EMPLOYEE_CART = '__employee__';
const BRANCH_CART_PREFIX = 'oppa:branch-cart:v1:';

const safeParse = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const normalizeBranchCart = (value: unknown, fallbackCutlery = false): BranchCart => {
  if (Array.isArray(value)) {
    return { items: value as CartItem[], useCutlery: fallbackCutlery };
  }
  if (value && typeof value === 'object') {
    const saved = value as Partial<BranchCart>;
    return {
      items: Array.isArray(saved.items) ? saved.items : [],
      useCutlery: typeof saved.useCutlery === 'boolean' ? saved.useCutlery : fallbackCutlery,
    };
  }
  return { items: [], useCutlery: fallbackCutlery };
};

const encode = (value: string): string => encodeURIComponent(value);
const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const branchCartStorageKey = (owner: string, branchId: string): string =>
  `${BRANCH_CART_PREFIX}${encode(owner)}:${encode(branchId)}`;

export const branchCartStoragePrefix = (owner: string): string =>
  `${BRANCH_CART_PREFIX}${encode(owner)}:`;

export const legacyCartKeyForOwner = (owner: string): string =>
  owner.startsWith('user:')
    ? `cart_user_${owner.slice('user:'.length)}`
    : 'cart_employee_register';

export const readBranchCart = (storage: Storage, owner: string, branchId: string): BranchCart =>
  normalizeBranchCart(safeParse(storage.getItem(branchCartStorageKey(owner, branchId))));

export const readCartAtStorageKey = (storage: Storage, key: string, fallbackCutlery = false): BranchCart =>
  normalizeBranchCart(safeParse(storage.getItem(key)), fallbackCutlery);

export const writeBranchCart = (storage: Storage, owner: string, branchId: string, cart: BranchCart): void => {
  storage.setItem(branchCartStorageKey(owner, branchId), JSON.stringify(cart));
};

export const updateBranchCart = (
  storage: Storage,
  owner: string,
  branchId: string,
  update: (cart: BranchCart) => BranchCart,
): BranchCart => {
  const updated = update(readBranchCart(storage, owner, branchId));
  writeBranchCart(storage, owner, branchId, updated);
  return updated;
};

export const loadBranchCarts = (
  storage: Storage,
  owner: string,
  legacyKey: string,
  selectedBranchId: string | null,
): Record<string, BranchCart> => {
  const carts: Record<string, BranchCart> = {};
  const keyPrefix = branchCartStoragePrefix(owner);

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(keyPrefix)) continue;
    const branchId = decode(key.slice(keyPrefix.length));
    carts[branchId] = normalizeBranchCart(safeParse(storage.getItem(key)));
  }

  if (carts[selectedBranchId || UNASSIGNED_BRANCH]) return carts;

  const legacy = safeParse(storage.getItem(legacyKey));
  if (Array.isArray(legacy) && legacy.length > 0) {
    const branchId = selectedBranchId || UNASSIGNED_BRANCH;
    const useCutlery = safeParse(storage.getItem('cutleryPreference')) === true;
    const migrated = normalizeBranchCart(legacy, useCutlery);
    writeBranchCart(storage, owner, branchId, migrated);
    storage.removeItem(legacyKey);
    carts[branchId] = migrated;
  }

  return carts;
};

export const getBranchCartItemCount = (cart: BranchCart | undefined): number =>
  (cart?.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);

export const getCheckoutBranchId = (selectedBranchId: string | null, resolvedBranchId: string | null): string | null =>
  selectedBranchId && selectedBranchId === resolvedBranchId ? selectedBranchId : null;
