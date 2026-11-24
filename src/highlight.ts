import {
  createElement,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type {ArrayOfObjectsMember, ObjectItemProps, RenderArrayOfObjectsItemCallback} from 'sanity'

/** The `_key` of the item hovered in the array list, shared between the list and the image. */
export interface HoverStore {
  get: () => string | null
  set: (key: string | null) => void
  subscribe: (listener: () => void) => () => void
}

export function createHoverStore(): HoverStore {
  let current: string | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (key) => {
      if (key === current) return
      current = key
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** A hover store that lives as long as the component. */
export function useHoverStore(): HoverStore {
  const [store] = useState(createHoverStore)
  return store
}

const noopSubscribe = () => () => undefined
const getNull = () => null

/** The hovered list item's key. Only the caller re-renders when it changes. */
export function useHoveredKey(store: HoverStore | undefined): string | null {
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.get ?? getNull, getNull)
}

/** Keys of items that are open (edit dialog/popover) or have focus inside them. */
export function useActiveKeys(members: ArrayOfObjectsMember[]): Set<string> {
  return useMemo(() => {
    const keys = new Set<string>()
    for (const member of members) {
      if (member.kind !== 'item') continue
      if (member.open || member.item.focused || member.item.focusPath.length > 0) {
        keys.add(member.key)
      }
    }
    return keys
  }, [members])
}

/**
 * Wraps the array's `renderItem` so hovering a row in the list highlights its spot. The wrapper
 * is `display: contents`, so it doesn't change the list's layout.
 */
export function useHoverRenderItem(
  renderItem: RenderArrayOfObjectsItemCallback,
  store: HoverStore | undefined,
): RenderArrayOfObjectsItemCallback {
  const wrapped = useCallback(
    (itemProps: Omit<ObjectItemProps, 'renderDefault'>): ReactNode => {
      const key = (itemProps.value as {_key?: string} | undefined)?._key
      const child = renderItem(itemProps)
      if (!store || !key) return child
      return createElement(
        'div',
        {
          style: {display: 'contents'},
          onMouseEnter: () => store.set(key),
          onMouseLeave: () => {
            if (store.get() === key) store.set(null)
          },
        },
        child,
      )
    },
    [renderItem, store],
  )
  return wrapped
}
