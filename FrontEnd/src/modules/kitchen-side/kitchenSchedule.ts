export interface KitchenScheduleState {
  kind: 'early' | 'soon' | 'open' | 'due-soon' | 'late';
  label: string;
  detail: string;
}

const getMinutesRemaining = (target: string | null | undefined, now: number): number | null => {
  if (!target) return null;
  const timestamp = new Date(target).getTime();
  return Number.isFinite(timestamp) ? Math.ceil((timestamp - now) / 60_000) : null;
};

const formatDuration = (minutes: number): string => {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
};

export const getKitchenScheduleState = (
  prepStartTime: string,
  scheduledFor: string,
  now = Date.now(),
): KitchenScheduleState => {
  const prepMinutes = getMinutesRemaining(prepStartTime, now);
  const dueMinutes = getMinutesRemaining(scheduledFor, now);

  if (prepMinutes === null || dueMinutes === null) {
    return { kind: 'early', label: 'Scheduled', detail: 'Schedule time unavailable' };
  }
  if (dueMinutes < 0) {
    return { kind: 'late', label: 'LATE', detail: `Late by ${formatDuration(Math.ceil(Math.abs(dueMinutes)))}` };
  }
  if (prepMinutes > 60) {
    return { kind: 'early', label: 'Scheduled', detail: `Prep starts in ${formatDuration(prepMinutes)}` };
  }
  if (prepMinutes > 0) {
    return { kind: 'soon', label: 'Starting soon', detail: `Prep starts in ${formatDuration(prepMinutes)}` };
  }
  if (dueMinutes <= 15) {
    return { kind: 'due-soon', label: 'PRIORITY', detail: `Due in ${formatDuration(dueMinutes)}` };
  }
  return { kind: 'open', label: 'Prep window open', detail: `Due in ${formatDuration(dueMinutes)}` };
};

export const formatKitchenManilaDateTime = (
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(date);
};

export const getKitchenScheduleTone = (kind: KitchenScheduleState['kind']): string => {
  const tones: Record<KitchenScheduleState['kind'], string> = {
    early: 'border-blue-200 bg-blue-50 text-blue-900',
    soon: 'border-amber-200 bg-amber-50 text-amber-950',
    open: 'border-orange-300 bg-orange-50 text-orange-950',
    'due-soon': 'border-orange-400 bg-orange-100 text-orange-950',
    late: 'border-red-300 bg-red-50 text-red-900',
  };
  return tones[kind];
};

export const toLocalDateTimeInput = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

export const fromManilaDateTimeInput = (value: string): string => {
  const date = new Date(`${value}:00+08:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
};
