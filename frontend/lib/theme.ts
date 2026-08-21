export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'miaomiaoverse-theme'

export function readStoredTheme(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): string | null {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function persistTheme(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  theme: ResolvedTheme,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme changes must continue to work when browser storage is blocked.
  }
}

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
    var storedTheme = null
    var prefersDark = false

    try {
      storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}')
    } catch (error) {}

    try {
      prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch (error) {}

    var theme = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : prefersDark
        ? 'dark'
        : 'light'

    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  })()
`
