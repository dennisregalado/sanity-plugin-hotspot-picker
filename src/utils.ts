import type {Path} from 'sanity'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** A random `_key`, like Sanity's own. */
export function randomKey(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

/** Clamp to 0–100 and round to two decimals. */
export function toPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100
}

/** The image field's path: the array's parent plus `imagePath` (dots for nesting). */
export function resolveImagePath(arrayPath: Path, imagePath: string): Path {
  return [...arrayPath.slice(0, -1), ...imagePath.split('.').filter(Boolean)]
}
