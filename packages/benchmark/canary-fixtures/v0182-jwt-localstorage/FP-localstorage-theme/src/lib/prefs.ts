export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem('theme', theme);
}
export function setLanguage(lang: string): void {
  localStorage.setItem('language', lang);
  localStorage.setItem('preferred_locale', lang);
}
