export const stripEmoji = (title: string): string => (
  title
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\p{Emoji_Modifier}/gu, '')
    .replace(/\p{Regional_Indicator}/gu, '')
    .replace(/[\u20E3\uFE0E\uFE0F\u200D]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .trim()
);

const PROMO_TIME_ZONE = 'Asia/Manila';

const formatPromoDateTimeInput = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROMO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const parsePromoDateTimeInput = (value: string): Date => (
  new Date(`${value.length === 16 ? `${value}:00` : value}+08:00`)
);

export const getPromoDateTimeMin = (): string => formatPromoDateTimeInput(new Date());

export const getPromoDateTimeTimestamp = (value: string): number => (
  parsePromoDateTimeInput(value).getTime()
);

export const toPromoApiDateTime = (value: string): string => {
  const date = parsePromoDateTimeInput(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid promo date and time.');
  }
  return date.toISOString();
};

export const toPromoDateTimeInput = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatPromoDateTimeInput(date);
};
