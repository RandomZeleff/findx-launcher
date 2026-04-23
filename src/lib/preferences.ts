/** Préférences persistantes (localStorage), partagées entre les vues. */

export const PREF_LIBRARY_COMPACT_GRID = 'findx_pref_library_compact_grid'
export const PREF_AUTO_SHORTCUT        = 'findx_pref_auto_shortcut'
export const PREF_NOTIFICATIONS        = 'findx_pref_notifications'
export const PREF_AUTO_SEED            = 'findx_pref_auto_seed'

export function getBoolPref(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return defaultValue
    return v === '1' || v === 'true'
  } catch {
    return defaultValue
  }
}

export function setBoolPref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* quota */
  }
}

export function initialLibraryCompactGrid(): boolean {
  return getBoolPref(PREF_LIBRARY_COMPACT_GRID, false)
}

export function initialAutoShortcut(): boolean {
  return getBoolPref(PREF_AUTO_SHORTCUT, true)
}

export function initialNotifications(): boolean {
  return getBoolPref(PREF_NOTIFICATIONS, true)
}

export function initialAutoSeed(): boolean {
  return getBoolPref(PREF_AUTO_SEED, true)
}
