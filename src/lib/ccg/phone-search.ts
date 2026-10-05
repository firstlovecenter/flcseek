/**
 * The digits to look for when someone searches by phone number. Numbers are
 * stored as 233XXXXXXXXX, so a search typed the local way (024 123…) drops
 * its leading 0 to match. Empty when the term has no digits.
 */
export function phoneSearchDigits(term: string): string {
  const d = term.replace(/\D/g, '')
  if (d.startsWith('00233')) return d.slice(2)
  if (d.startsWith('233')) return d.startsWith('2330') ? `233${d.slice(4)}` : d
  return d.replace(/^0+/, '')
}
