export interface StoreHoursClockConfig {
  opening: string;
  last_order: string;
  closing: string;
  timezone: string;
}

export interface DeviceStoreHoursStatus {
  state: 'open' | 'last_order_passed' | 'closed';
  current_store_time: string;
  next_opening_at: string;
  next_opening_label: string;
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const getZonedDateParts = (date: Date, timeZone: string): ZonedDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

const parseClockMinutes = (value: string): number => {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Invalid store-hours time: ${value}`);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) throw new Error(`Invalid store-hours time: ${value}`);

  return ((hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + minute;
};

const getOffsetMinutes = (date: Date, timeZone: string): number => {
  const parts = getZonedDateParts(date, timeZone);
  const localTimeAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((localTimeAsUtc - date.getTime()) / 60_000);
};

const toZonedIsoString = (parts: ZonedDateParts, hour: number, minute: number, timeZone: string): string => {
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
  let timestamp = desiredUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    timestamp = desiredUtc - getOffsetMinutes(new Date(timestamp), timeZone) * 60_000;
  }
  return new Date(timestamp).toISOString();
};

export const getDeviceStoreHoursStatus = (
  configuredHours: StoreHoursClockConfig,
  now: Date = new Date(),
): DeviceStoreHoursStatus => {
  const currentParts = getZonedDateParts(now, configuredHours.timezone);
  const currentMinutes = currentParts.hour * 60 + currentParts.minute;
  const openingMinutes = parseClockMinutes(configuredHours.opening);
  const lastOrderMinutes = parseClockMinutes(configuredHours.last_order);
  const closingMinutes = parseClockMinutes(configuredHours.closing);

  const state = currentMinutes < openingMinutes || currentMinutes >= closingMinutes
    ? 'closed'
    : currentMinutes >= lastOrderMinutes
      ? 'last_order_passed'
      : 'open';
  const opensToday = currentMinutes < openingMinutes;
  const nextOpeningDate = new Date(Date.UTC(
    currentParts.year,
    currentParts.month - 1,
    currentParts.day + (opensToday ? 0 : 1),
  ));
  const nextOpeningParts = getZonedDateParts(nextOpeningDate, configuredHours.timezone);
  const nextOpeningAt = toZonedIsoString(
    nextOpeningParts,
    Math.floor(openingMinutes / 60),
    openingMinutes % 60,
    configuredHours.timezone,
  );

  return {
    state,
    current_store_time: now.toISOString(),
    next_opening_at: nextOpeningAt,
    next_opening_label: `Opens ${opensToday ? 'today' : 'tomorrow'} at ${configuredHours.opening}`,
  };
};
