import { ORDER_STATUS } from './constants';

export const ORDER_EDIT_WINDOW_SECONDS = 20;
export const ORDER_CANCELLATION_WINDOW_SECONDS = 30;

export const normalizeOrderStatus = (status?: string) =>
  (status ?? '').toString().trim().toLowerCase();

export const getOrderCreatedAtMs = (order: any) => {
  if (!order) return 0;

  if (Number.isFinite(order.graceStartedAt) && order.graceStartedAt > 0) {
    return order.graceStartedAt;
  }

  const rawTimestamp =
    order.timestamp ??
    order.created_at ??
    order.createdAt ??
    order.updated_at ??
    order.updatedAt ??
    0;

  const parsedTimestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
};

export const getGraceStartedAt = (order: any) => {
  const createdAt = getOrderCreatedAtMs(order);
  return createdAt > 0 ? createdAt : Date.now();
};

export const getOrderGraceRemainingSeconds = (
  order: any,
  graceStartedAtByOrder?: Record<string, number>
) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.PENDING) return 0;

  const startedAt = graceStartedAtByOrder?.[String(order.id)] ?? getGraceStartedAt(order);
  const elapsed = (Date.now() - startedAt) / 1000;
  return Math.max(0, ORDER_EDIT_WINDOW_SECONDS - elapsed);
};

export const canManageOrder = (
  order: any,
  graceStartedAtByOrder?: Record<string, number>
) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.PENDING) return false;
  return getOrderGraceRemainingSeconds(order, graceStartedAtByOrder) > 0;
};

export const getOrderCancellationRemainingSeconds = (
  order: any
) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.PENDING) return 0;

  const remaining = Number(order.cancellationRemainingSeconds);
  const receivedAt = Number(order.cancellationRemainingReceivedAt);
  if (!Number.isFinite(remaining) || !Number.isFinite(receivedAt)) return 0;

  return Math.max(0, remaining - (performance.now() - receivedAt) / 1000);
};

export const canCancelOrder = (order: any) => getOrderCancellationRemainingSeconds(order) > 0;

export const getOrderFeeBreakdown = (order: any) => {
  const productSubtotal = (order?.items || []).reduce((sum: number, item: any) => {
    const addonTotal = (item.selectedAddons || item.selected_addons || []).reduce(
      (addonSum: number, addon: any) => addonSum + Number(addon.price || 0),
      0
    );
    return sum + ((Number(item.price || 0) * Number(item.quantity || 1)) + addonTotal);
  }, 0);

  let deliveryFee = Number(order?.deliveryFee ?? order?.delivery_fee ?? 0);
  const serviceFee = Number(order?.serviceFee ?? order?.service_fee ?? 0);
  let priorityFee = Number(order?.priorityFee ?? order?.priority_fee ?? 0);
  let vat = Number(order?.vat ?? order?.vat_value ?? 0);

  if (priorityFee === 0 && order?.deliveryType === 'priority') {
    priorityFee = 99;
  }

  if (deliveryFee === 0 && Number(order?.total || 0) > 0) {
    const derived = Number(order.total) - productSubtotal - serviceFee - priorityFee - vat;
    deliveryFee = Math.max(0, Math.round(derived));
  }

  if (vat === 0 && Number(order?.total || 0) > 0) {
    const beforeVat = productSubtotal + deliveryFee + serviceFee + priorityFee;
    vat = Math.round((Number(order.total) - beforeVat) * 100) / 100;
    if (vat < 0) vat = 0;
  }

  return { productSubtotal, deliveryFee, serviceFee, priorityFee, vat };
};
