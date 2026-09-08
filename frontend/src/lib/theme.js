// Theme switching: Tailwind darkMode is ["class"], so light/dark is decided
// by the `dark` class on <html>. Dark stays the default (the app's original
// look); the choice persists per browser in localStorage.
const STORAGE_KEY = 'sastagram-theme';

export const getTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable (private mode etc.) — fall through */
  }
  return 'dark';
};

export const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* non-fatal */
  }
  // Lets non-React consumers (Toaster) follow along
  window.dispatchEvent(new CustomEvent('sastagram-theme', { detail: theme }));
};

// Called before React renders so the first paint is already themed
export const initTheme = () => {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark');
};

export const toggleTheme = () => {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
};
