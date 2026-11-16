import {PinIcon} from '@sanity/icons/Pin'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {Button, type Placement} from '@sanity/ui'
import {Popover} from '@sanity/ui/popover'
import {
  type ComponentType,
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
  onMove: (key: string, x: number, y: number) => void
  onOpen: (key: string) => void
}

/** A draggable marker. Drag to move it, click to open the item. */
export function Spot(props: SpotProps): ReactNode {
  const {value, frameRef, schemaType, renderPreview, invalid, readOnly, icon, placement} = props
  const {itemPath, onMove, onOpen} = props

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

  // Local position while dragging; the stored value is only patched on release.
  const [dragPosition, setDragPosition] = useState<{x: number; y: number} | null>(null)
  const start = useRef<{x: number; y: number} | null>(null)

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

  // Pointer clicks open from `pointerup`; Enter/Space fire a click with `detail` 0.
  const handleKeyboardClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) onOpen(value._key)
    },
    [onOpen, value._key],
  )

  const x = dragPosition?.x ?? value.x ?? 50
  const y = dragPosition?.y ?? value.y ?? 50
  const dragging = dragPosition !== null
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
          <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={{padding: 4}}>
            <SpotPreview
              value={value}
              itemPath={itemPath}
              schemaType={schemaType}
              renderPreview={renderPreview}
              target={target}
              referencePaneOpen={referencePaneOpen}
            />
          </div>
        }
      >
        <Button
          onClick={handleKeyboardClick}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label={`Edit ${schemaType.title ?? 'spot'}`}
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            cursor,
            touchAction: 'none',
          }}
          padding={2}
          icon={invalid ? WarningOutlineIcon : (icon ?? PinIcon)}
          mode="ghost"
          tone={invalid ? 'critical' : 'default'}
        />
      </Popover>
    </div>
  )
}
