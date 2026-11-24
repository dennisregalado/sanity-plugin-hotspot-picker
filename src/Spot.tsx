import {CopyIcon} from '@sanity/icons/Copy'
import {PinIcon} from '@sanity/icons/Pin'
import {TrashIcon} from '@sanity/icons/Trash'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {Box, Button, Flex, type Placement, Stack, Text} from '@sanity/ui'
import {Popover} from '@sanity/ui/popover'
import {Tooltip} from '@sanity/ui/tooltip'
import {
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {ObjectSchemaType, Path, RenderPreviewCallback} from 'sanity'

import {SpotPreview, useReferencePaneOpen, useReferenceTarget} from './SpotPreview'
import type {HotspotItem} from './types'
import {toPercent} from './utils'

/** Pointer travel (px) before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3

/** Delay (ms) before the popover closes, so the pointer can cross from the spot onto it. */
const CLOSE_DELAY = 150

/** Arrow-key nudge, in percent of the image (with Shift: `NUDGE_LARGE`). */
const NUDGE = 0.5
const NUDGE_LARGE = 5

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

// The marker sits on arbitrary photos, so it doesn't follow the Studio's color scheme: a solid
// fill with a white ring and a shadow reads on light, dark and busy images alike.
const MARKER_SIZE = 28
const FILL = 'rgba(17, 18, 22, 0.9)'
const FILL_ACTIVE = '#2276fc'
const FILL_INVALID = '#e02e2a'
const HALO_ACTIVE = 'rgba(34, 118, 252, 0.45)'
const HALO_INVALID = 'rgba(224, 46, 42, 0.45)'

function markerStyle(state: {
  invalid: boolean
  highlighted: boolean
  dragging: boolean
  focusVisible: boolean
  cursor: string
}): CSSProperties {
  const {invalid, highlighted, dragging, focusVisible, cursor} = state
  let background = FILL
  if (invalid) background = FILL_INVALID
  else if (highlighted) background = FILL_ACTIVE
  const halo = highlighted ? `, 0 0 0 6px ${invalid ? HALO_INVALID : HALO_ACTIVE}` : ''
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    margin: 0,
    padding: 0,
    border: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background,
    color: '#fff',
    boxShadow: `0 0 0 2px #fff, 0 2px 6px rgba(0, 0, 0, ${dragging ? 0.55 : 0.4})${halo}`,
    outline: focusVisible ? `2px solid ${FILL_ACTIVE}` : 'none',
    outlineOffset: 4,
    transform: `translate(-50%, -50%) scale(${highlighted || dragging ? 1.15 : 1})`,
    transition: 'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
    cursor,
    touchAction: 'none',
    fontVariantNumeric: 'tabular-nums',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  }
}

export interface SpotProps {
  value: HotspotItem
  /** Path of this item, for opening its reference. */
  itemPath: Path
  frameRef: RefObject<HTMLDivElement | null>
  schemaType: ObjectSchemaType
  renderPreview: RenderPreviewCallback
  invalid: boolean
  readOnly?: boolean
  icon?: ComponentType
  placement?: Placement
  /** Shown on the marker instead of the icon (the item's position in the list, from 1). */
  number?: number
  /** The item is open or focused in the form, or hovered in the list. */
  active?: boolean
  onMove: (key: string, x: number, y: number) => void
  onOpen: (key: string) => void
  onRemove: (key: string) => void
  onDuplicate: (key: string) => void
}

/**
 * A draggable marker. Drag (or arrow keys) to move it, click to open the item, Delete to remove
 * it. Hover or keyboard focus opens its preview, with remove/duplicate actions.
 */
export function Spot(props: SpotProps): ReactNode {
  const {value, frameRef, schemaType, renderPreview, invalid, readOnly, icon, placement} = props
  const {itemPath, number, active, onMove, onOpen, onRemove, onDuplicate} = props

  // Open while the pointer is over the spot or its popover, and while its reference is open.
  const [hovered, setHovered] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])
  const handleEnter = useCallback(() => {
    cancelClose()
    setHovered(true)
  }, [cancelClose])
  const handleLeave = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setHovered(false), CLOSE_DELAY)
  }, [cancelClose])
  useEffect(() => cancelClose, [cancelClose])
  const target = useReferenceTarget(value, schemaType)
  const referencePaneOpen = useReferencePaneOpen(target)

  // Keyboard focus opens the popover too (focus from a click doesn't, the item opens instead).
  const [focusVisible, setFocusVisible] = useState(false)
  const handleFocus = useCallback(
    (event: FocusEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.matches(':focus-visible')) return
      setFocusVisible(true)
      handleEnter()
    },
    [handleEnter],
  )
  const handleBlur = useCallback(() => {
    setFocusVisible(false)
    handleLeave()
  }, [handleLeave])

  // Local position while dragging; the stored value is only patched on release.
  const [dragPosition, setDragPosition] = useState<{x: number; y: number} | null>(null)
  const start = useRef<{x: number; y: number} | null>(null)
  const capture = useRef<{element: HTMLButtonElement; pointerId: number} | null>(null)

  const positionFromEvent = useCallback(
    (event: PointerEvent) => {
      const rect = frameRef.current?.getBoundingClientRect()
      if (!rect?.width || !rect.height) return null
      return {
        x: toPercent(((event.clientX - rect.left) / rect.width) * 100),
        y: toPercent(((event.clientY - rect.top) / rect.height) * 100),
      }
    },
    [frameRef],
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (readOnly || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      capture.current = {element: event.currentTarget, pointerId: event.pointerId}
      start.current = {x: event.clientX, y: event.clientY}
    },
    [readOnly],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!start.current) return
      const moved = Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y)
      if (!dragPosition && moved < DRAG_THRESHOLD) return
      const next = positionFromEvent(event)
      if (next) setDragPosition(next)
    },
    [dragPosition, positionFromEvent],
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!start.current) return
      start.current = null
      if (dragPosition) {
        onMove(value._key, dragPosition.x, dragPosition.y)
        setDragPosition(null)
      } else {
        onOpen(value._key)
      }
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [dragPosition, onMove, onOpen, value._key],
  )

  const handlePointerCancel = useCallback(() => {
    start.current = null
    setDragPosition(null)
  }, [])

  // Escape cancels a drag in progress: the spot goes back to its stored position.
  const dragging = dragPosition !== null
  useEffect(() => {
    if (!dragging) return undefined
    const handleKey = (event: {key: string; preventDefault(): void; stopPropagation(): void}) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      start.current = null
      setDragPosition(null)
      const current = capture.current
      if (current?.element.hasPointerCapture(current.pointerId)) {
        current.element.releasePointerCapture(current.pointerId)
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [dragging])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (readOnly || dragging || event.altKey || event.metaKey || event.ctrlKey) return
      const arrow = ARROWS[event.key]
      if (arrow) {
        event.preventDefault()
        const step = event.shiftKey ? NUDGE_LARGE : NUDGE
        onMove(
          value._key,
          toPercent((value.x ?? 50) + arrow[0] * step),
          toPercent((value.y ?? 50) + arrow[1] * step),
        )
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onRemove(value._key)
      } else if (event.key === 'Escape' && hovered) {
        cancelClose()
        setHovered(false)
      }
    },
    [readOnly, dragging, onMove, onRemove, value._key, value.x, value.y, hovered, cancelClose],
  )

  // Pointer clicks open from `pointerup`; Enter/Space fire a click with `detail` 0.
  const handleKeyboardClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) onOpen(value._key)
    },
    [onOpen, value._key],
  )

  const x = dragPosition?.x ?? value.x ?? 50
  const y = dragPosition?.y ?? value.y ?? 50
  let cursor = 'grab'
  if (readOnly) cursor = 'pointer'
  else if (dragging) cursor = 'grabbing'

  return (
    <div style={{position: 'absolute', left: `${x}%`, top: `${y}%`, zIndex: dragging ? 1 : 0}}>
      <Popover
        open={!dragging && (hovered || referencePaneOpen)}
        portal
        animate
        radius={2}
        shadow={2}
        placement={placement ?? 'top'}
        fallbackPlacements={['bottom', 'right', 'left']}
        content={
          <Flex
            align="center"
            gap={1}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{padding: 4}}
          >
            <Box flex={1}>
              <SpotPreview
                value={value}
                itemPath={itemPath}
                schemaType={schemaType}
                renderPreview={renderPreview}
                target={target}
                referencePaneOpen={referencePaneOpen}
              />
            </Box>
            {!readOnly && (
              <Stack gap={1} paddingRight={1}>
                <SpotAction
                  label="Duplicate"
                  icon={CopyIcon}
                  itemKey={value._key}
                  onClick={onDuplicate}
                />
                <SpotAction
                  label="Remove"
                  icon={TrashIcon}
                  tone="critical"
                  itemKey={value._key}
                  onClick={onRemove}
                />
              </Stack>
            )}
          </Flex>
        }
      >
        <button
          type="button"
          data-spot={value._key}
          onClick={handleKeyboardClick}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label={`Edit ${schemaType.title ?? 'spot'}${number ? ` ${number}` : ''}`}
          aria-keyshortcuts={readOnly ? undefined : 'ArrowUp ArrowDown ArrowLeft ArrowRight Delete'}
          style={markerStyle({
            invalid,
            highlighted: Boolean(active) || hovered || referencePaneOpen,
            dragging,
            focusVisible,
            cursor,
          })}
        >
          {number === undefined ? (
            <MarkerIcon icon={invalid ? WarningOutlineIcon : (icon ?? PinIcon)} />
          ) : (
            <Text size={1} weight="semibold" style={{color: 'inherit'}}>
              {number}
            </Text>
          )}
        </button>
      </Popover>
    </div>
  )
}

function MarkerIcon(props: {icon: ComponentType}): ReactNode {
  const Icon = props.icon
  return (
    <span style={{display: 'flex', fontSize: 21}} aria-hidden>
      <Icon />
    </span>
  )
}

function SpotAction(props: {
  label: string
  icon: ComponentType
  tone?: 'critical'
  itemKey: string
  onClick: (key: string) => void
}): ReactNode {
  const {label, icon, tone, itemKey, onClick} = props
  const handleClick = useCallback(() => onClick(itemKey), [onClick, itemKey])
  return (
    <Tooltip
      animate
      delay={5}
      placement="right"
      portal
      content={
        <Text size={1} weight="medium">
          {label}
        </Text>
      }
    >
      <Button
        mode="bleed"
        tone={tone}
        icon={icon}
        padding={2}
        fontSize={1}
        aria-label={label}
        onClick={handleClick}
      />
    </Tooltip>
  )
}
