import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CalendarClock, Check, CheckCircle, ChefHat, Clock3, Copy, PackageCheck, Phone,
  Printer, ShoppingBag, Truck, X,
} from 'lucide-react';
import type { KitchenOrder } from '../kitchenOrderTypes';
import {
  formatKitchenManilaDateTime, fromManilaDateTimeInput, getKitchenScheduleState, getKitchenScheduleTone, toLocalDateTimeInput,
} from '../kitchenSchedule';

interface OrderDetailsModalProps {
  order: KitchenOrder;
  busy?: boolean;
  onClose: () => void;
  onStart: (order: KitchenOrder, startEarly?: boolean) => void;
  onComplete: (order: KitchenOrder) => void;
  onReschedule: (order: KitchenOrder, scheduledFor: string) => void;
  onCancel: (order: KitchenOrder) => void;
}

export const ScheduleCard = ({ order, now }: { order: KitchenOrder; now: number }) => {
  if (!order.isScheduled || !order.scheduledFor || !order.prepStartTime) return null;
  const schedule = getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now);
  const ScheduleIcon = schedule.kind === 'late' ? AlertTriangle : Clock3;

  return (
    <section className={`rounded-2xl border p-5 ${getKitchenScheduleTone(schedule.kind)}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white/80 p-2"><ScheduleIcon size={22} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider">Scheduled order</p>
          <h3 className="mt-1 font-serif text-xl font-bold">
            Due: {formatKitchenManilaDateTime(order.scheduledFor, { weekday: 'short', year: undefined })}
          </h3>
          <p className="mt-1 text-sm font-semibold">{schedule.label} · {schedule.detail}</p>
          <p className="mt-2 text-sm">
            Prep starts: <strong>{formatKitchenManilaDateTime(order.prepStartTime)}</strong>
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-current/15 pt-3 text-sm font-medium">
        {order.fulfillmentType === 'pickup' ? <ShoppingBag size={17} /> : <Truck size={17} />}
        {order.fulfillmentType === 'pickup' ? 'Customer pickup' : 'Delivery'}
        <span className="ml-auto">Prep lead: {order.prepLeadTimeMinutes ?? 30} min</span>
      </div>
    </section>
  );
};

export const OrderItemsList = ({ order }: { order: KitchenOrder }) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const totalQuantity = order.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section>
      <h3 className="mb-2 font-semibold text-[var(--oppa-text)]">Items to Prepare</h3>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 px-4">
        {order.items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-start gap-3 py-3">
            <input
              type="checkbox"
              aria-label={`Mark ${item.name} prepared`}
              checked={Boolean(checkedItems[index])}
              onChange={(event) => setCheckedItems((current) => ({ ...current, [index]: event.target.checked }))}
              className="mt-1 size-4 accent-[var(--oppa-green)]"
            />
            <div className="min-w-0 flex-1">
              <p className={`font-medium text-[var(--oppa-text)] ${checkedItems[index] ? 'text-gray-400 line-through' : ''}`}>
                <span className="mr-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{item.quantity}x</span>
                {item.name}
              </p>
              {(item.selected_size || item.selected_addons?.length) && (
                <p className="mt-1 text-xs text-gray-500">
                  {[item.selected_size, ...(item.selected_addons || []).map((addon) => `${addon.name}${addon.quantity > 1 ? ` ×${addon.quantity}` : ''}`)].filter(Boolean).join(' · ')}
                </p>
              )}
              {item.special_instructions && <p className="mt-1 text-xs text-amber-800">Note: {item.special_instructions}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-xs text-gray-500">{order.items.length} items · Total qty: {totalQuantity}</p>
    </section>
  );
};

export const OrderTimeline = ({ order, now }: { order: KitchenOrder; now: number }) => {
  const [expanded, setExpanded] = useState(false);
  const timeline = [
    { label: 'Placed', date: order.created_at, complete: true },
    { label: 'Scheduled for', date: order.isScheduled ? order.scheduledFor : null, complete: Boolean(order.isScheduled && order.scheduledFor && new Date(order.scheduledFor).getTime() <= now) },
    { label: 'Prep starts', date: order.isScheduled ? order.prepStartTime : null, complete: order.status !== 'pending' },
    { label: 'Ready', date: null, complete: ['prepared', 'ready', 'delivered', 'completed'].includes(order.status) },
    { label: 'Completed', date: null, complete: ['delivered', 'completed'].includes(order.status) },
  ];

  return (
    <section className="rounded-xl border border-[var(--oppa-border)]">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex min-h-11 w-full items-center justify-between px-4 text-left font-semibold">
        Order timeline <span className="text-xs text-gray-500">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <ol className="space-y-3 border-t border-gray-100 px-4 py-3">
          {timeline.map((step) => (
            <li key={step.label} className={`flex items-center gap-3 text-sm ${step.complete ? 'text-[var(--oppa-green)]' : 'text-gray-400'}`}>
              {step.complete ? <CheckCircle size={16} /> : <span className="size-4 rounded-full border border-current" />}
              <span className="font-medium">{step.label}</span>
              {step.date && <time className="ml-auto text-xs">{formatKitchenManilaDateTime(step.date)}</time>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character] || character));

const printKitchenTicket = (order: KitchenOrder) => {
  const ticket = window.open('', '_blank', 'width=440,height=720');
  if (!ticket) {
    window.alert('Allow pop-ups to print the kitchen ticket.');
    return;
  }
  const items = order.items.map((item) => `<li><strong>${item.quantity}x</strong> ${escapeHtml(item.name)}${item.selected_size ? `<small>${escapeHtml(item.selected_size)}</small>` : ''}${item.special_instructions ? `<small>Note: ${escapeHtml(item.special_instructions)}</small>` : ''}</li>`).join('');
  ticket.document.write(`<!doctype html><html><head><title>Kitchen ticket</title><style>body{font:14px Arial,sans-serif;padding:24px;color:#15251b}h1{font-size:20px}small{display:block;color:#555;margin:4px 0 0 32px}li{padding:10px 0;border-bottom:1px solid #ddd}header{border-bottom:2px dashed #333;padding-bottom:12px}</style></head><body><header><h1>OPPA DRU · KITCHEN TICKET</h1><p>${escapeHtml(order.order_number || order.id)}</p><p>${escapeHtml(formatKitchenManilaDateTime(order.created_at))}</p>${order.scheduledFor ? `<p>DUE: ${escapeHtml(formatKitchenManilaDateTime(order.scheduledFor))}</p>` : ''}<p>${escapeHtml(order.customerName)} · ${escapeHtml(order.fulfillmentType || 'delivery')}</p></header><ul>${items}</ul>${order.specialInstructions ? `<p><strong>Order notes:</strong> ${escapeHtml(order.specialInstructions)}</p>` : ''}<script>window.onload=()=>{window.print();window.close()}</script></body></html>`);
  ticket.document.close();
};

const OrderDetailsModal = ({ order, busy = false, onClose, onStart, onComplete, onReschedule, onCancel }: OrderDetailsModalProps) => {
  const [now, setNow] = useState(() => Date.now());
  const [rescheduling, setRescheduling] = useState(false);
  const [newSchedule, setNewSchedule] = useState(order.scheduledFor ? toLocalDateTimeInput(order.scheduledFor) : '');
  const [timelineId] = useState(() => `${order.id}-title`);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isCancelled = ['cancelled', 'canceled'].includes(order.status);
  const prepIsOpen = !order.isScheduled || !order.prepStartTime || new Date(order.prepStartTime).getTime() <= now;
  const timelineStatus = useMemo(() => order.status.replaceAll('_', ' '), [order.status]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const updateInterval = window.setInterval(() => setNow(Date.now()), 1000);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    closeRef.current?.focus();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearInterval(updateInterval);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [onClose]);

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(order.order_number || order.id);
    } catch {
      window.prompt('Copy order ID:', order.order_number || order.id);
    }
  };

  const requestStartEarly = () => {
    const dueTime = order.scheduledFor ? formatKitchenManilaDateTime(order.scheduledFor) : 'the scheduled time';
    if (window.confirm(`This order is scheduled for ${dueTime}. Start preparing now?`)) onStart(order, true);
  };

  const doCancel = () => {
    if (window.confirm(`Cancel order ${order.order_number || order.id}?`)) onCancel(order);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={timelineId} className="flex max-h-[92vh] w-full max-w-2xl animate-[fadeScale_180ms_ease-out] flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-start gap-3 rounded-t-2xl border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={timelineId} className="font-serif text-xl font-bold text-[var(--oppa-text)]">Order Details</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-gray-500">{order.order_number || order.id}</p>
              <button type="button" onClick={() => void copyOrderId()} aria-label="Copy order ID" className="rounded p-1 text-gray-500 hover:bg-gray-100"><Copy size={14} /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">{order.channel === 'onsite' ? 'Onsite' : 'Online'}</span>
              {order.isScheduled && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-900">Scheduled</span>}
              {isCancelled && <span className="rounded-full bg-red-100 px-2 py-1 text-red-900">Cancelled</span>}
              {order.isScheduled && order.scheduledFor && order.prepStartTime && (
                (() => {
                  const state = getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now);
                  const urgent = state.kind === 'late' || state.kind === 'due-soon';
                  return urgent ? <span className={`rounded-full px-2 py-1 ${state.kind === 'late' ? 'bg-red-100 text-red-900' : 'bg-orange-100 text-orange-900'}`}>{state.label}</span> : null;
                })()
              )}
              {order.deliveryType === 'priority' && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-900">PRIORITY</span>}
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close order details" className="grid size-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {isCancelled && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">This order was cancelled. Kitchen actions are disabled.</p>}
          {order.rescheduledFrom && order.scheduledFor && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <CalendarClock className="mr-2 inline" size={16} />
              Rescheduled: {formatKitchenManilaDateTime(order.rescheduledFrom)} → {formatKitchenManilaDateTime(order.scheduledFor)}
            </p>
          )}
          <ScheduleCard order={order} now={now} />

          <section className="grid gap-4 rounded-xl border border-gray-100 p-4 sm:grid-cols-2">
            <div><p className="text-xs text-gray-500">Customer</p><p className="mt-1 font-semibold">{order.customerName}</p></div>
            <div><p className="text-xs text-gray-500">Date Ordered</p><p className="mt-1 text-sm font-medium">{formatKitchenManilaDateTime(order.created_at)}</p></div>
            <div><p className="text-xs text-gray-500">Fulfillment</p><p className="mt-1 inline-flex items-center gap-2 font-medium">{order.fulfillmentType === 'pickup' ? <ShoppingBag size={16} /> : <Truck size={16} />}{order.fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery'}</p></div>
            <div><p className="text-xs text-gray-500">Payment</p><p className="mt-1 text-sm font-medium">{order.paymentMethod || 'Not available'}{order.paymentStatus ? ` · ${order.paymentStatus}` : ''}</p></div>
            {order.phone && <div className="sm:col-span-2"><a href={`tel:${order.phone}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--oppa-green)]"><Phone size={16} />{order.phone}</a></div>}
          </section>

          {order.specialInstructions && (
            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Special Instructions / Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{order.specialInstructions}</p>
            </aside>
          )}

          <OrderItemsList order={order} />
          <OrderTimeline order={order} now={now} />
          <p className="sr-only" aria-live="polite">Current order status: {timelineStatus}</p>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
          {order.status === 'pending' && (
            <>
              <button type="button" onClick={() => onStart(order)} disabled={busy || isCancelled || !prepIsOpen} title={!prepIsOpen && order.prepStartTime ? `Available at ${formatKitchenManilaDateTime(order.prepStartTime, { year: undefined, month: undefined, day: undefined })}` : undefined} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                <ChefHat size={17} /> Start Preparing
              </button>
              {order.isScheduled && !prepIsOpen && <button type="button" onClick={requestStartEarly} disabled={busy || isCancelled} className="min-h-11 rounded-xl border border-[var(--oppa-green)] px-3 py-2 text-sm font-semibold text-[var(--oppa-green)] disabled:opacity-50">Start Early</button>}
            </>
          )}
          {order.status === 'preparing' && <button type="button" onClick={() => onComplete(order)} disabled={busy || isCancelled} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 font-semibold text-white disabled:opacity-50"><PackageCheck size={17} /> Done Preparing</button>}
          <button type="button" onClick={() => printKitchenTicket(order)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"><Printer size={16} /> Print Ticket</button>
          {order.status === 'pending' && !isCancelled && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {order.isScheduled && (
                rescheduling ? (
                  <>
                    <input type="datetime-local" value={newSchedule} onChange={(event) => setNewSchedule(event.target.value)} className="min-h-11 flex-1 rounded-lg border border-gray-200 px-3 text-sm" />
                    <button type="button" onClick={() => onReschedule(order, fromManilaDateTimeInput(newSchedule))} disabled={busy || !newSchedule || !fromManilaDateTimeInput(newSchedule)} className="min-h-11 rounded-lg bg-amber-100 px-3 text-sm font-semibold text-amber-950">Save time</button>
                    <button type="button" onClick={() => setRescheduling(false)} className="min-h-11 rounded-lg px-3 text-sm">Cancel edit</button>
                  </>
                ) : <button type="button" onClick={() => setRescheduling(true)} className="min-h-11 rounded-lg border border-amber-200 px-3 text-sm font-medium text-amber-950">Reschedule</button>
              )}
              <button type="button" onClick={doCancel} disabled={busy} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-50">Cancel Order</button>
            </div>
          )}
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-gray-600">Close</button>
          <span className="sr-only"><Check aria-hidden="true" /></span>
        </footer>
      </section>
    </div>
  );
};

export default OrderDetailsModal;
