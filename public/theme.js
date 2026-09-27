// Applies the saved or system theme before the app loads, to avoid a flash of the wrong theme.
// A file rather than an inline script so the Content-Security-Policy can forbid inline scripts.
// Keep the storage key in sync with ThemeService.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('theme');
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-bs-theme', theme);
})();
