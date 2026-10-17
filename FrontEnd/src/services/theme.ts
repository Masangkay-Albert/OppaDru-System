export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'oppa-theme';
const LEGACY_THEME_STORAGE_KEY = 'admin-theme';

export const getSavedTheme = (): Theme => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  return savedTheme === 'dark' ? 'dark' : 'light';
};

export const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  localStorage.setItem(LEGACY_THEME_STORAGE_KEY, theme);
};
