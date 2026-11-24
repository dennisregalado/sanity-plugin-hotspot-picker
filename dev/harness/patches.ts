import type {Patch} from './shims/sanity'

type Item = {_key: string; [key: string]: unknown}
type Value = {image?: unknown; items?: Item[]}

/** Applies the plugin's patches (paths under `items`) to the harness's value. */
export function applyPatches(value: Value, patches: Patch[]): Value {
  let items = value.items ? [...value.items] : undefined
  for (const patch of patches) {
    const [, target, field] = patch.path as [string, unknown, string | undefined]
    const index =
      typeof target === 'number'
        ? (target + (items?.length ?? 0)) % Math.max(1, items?.length ?? 1)
        : (items ?? []).findIndex((item) => item._key === (target as {_key?: string})?._key)
    if (patch.type === 'setIfMissing' && target === undefined) items ??= []
    else if (patch.type === 'insert') {
      items ??= []
      const at = items.length === 0 ? 0 : patch.position === 'before' ? index : index + 1
      items.splice(at, 0, ...(patch.items as Item[]))
    } else if (patch.type === 'unset' && field === undefined) {
      if (index >= 0) items?.splice(index, 1)
    } else if (patch.type === 'set' && field && items && index >= 0) {
      items[index] = {...items[index], [field]: patch.value}
    }
  }
  return {...value, items}
}
