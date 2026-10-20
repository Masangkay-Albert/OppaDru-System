export const stripEmoji = (title: string): string => (
  title
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\p{Emoji_Modifier}/gu, '')
    .replace(/\p{Regional_Indicator}/gu, '')
    .replace(/[\u20E3\uFE0E\uFE0F\u200D]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .trim()
);

export const getLocalDateTimeMin = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
