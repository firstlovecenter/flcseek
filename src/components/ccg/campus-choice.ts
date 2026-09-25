/**
 * A Campus Leader chooses a stream and portal each time they sign in (on
 * /ccg/choose). The choice is remembered for this browser session only.
 */
const KEY = 'ccg.campus-chosen'

export function markChosen() {
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // storage unavailable: they are asked again next time
  }
}

export function hasChosen(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1'
  } catch {
    return true // cannot remember: don't keep sending them back
  }
}
