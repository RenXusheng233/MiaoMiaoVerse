export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'miaomiaoverse-theme'

export function resolveTheme(
  storedTheme: string | null,
  prefersDark: boolean,
): ResolvedTheme {
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return prefersDark ? 'dark' : 'light'
}

export const themeBootstrapScript = `
  (function () {
    var storedTheme = localStorage.getItem('${THEME_STORAGE_KEY}')
    var theme = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  })()
`
