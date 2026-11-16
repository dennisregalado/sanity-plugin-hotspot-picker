import {PinIcon} from '@sanity/icons/Pin'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {Button, Card, type Placement} from '@sanity/ui'
import {Tooltip} from '@sanity/ui/tooltip'
import {
  type ComponentType,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from 'react'
import type {ObjectSchemaType, RenderPreviewCallback} from 'sanity'

import type {HotspotItem} from './types'
import {toPercent} from './utils'

/** Pointer travel (px) before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3

export interface SpotProps {
  value: HotspotItem
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
  const {onMove, onOpen} = props

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
  let tone: 'critical' | 'default' | 'suggest' = 'suggest'
  if (invalid) tone = 'critical'
  else if (dragging) tone = 'default'

  return (
    <div style={{position: 'absolute', left: `${x}%`, top: `${y}%`, zIndex: dragging ? 1 : 0}}>
      <Tooltip
        disabled={dragging}
        portal
        padding={0}
        animate
        placement={placement}
        content={
          <Card shadow={1} padding={0} style={{minWidth: 200}}>
            {renderPreview({value, schemaType, layout: 'default'})}
          </Card>
        }
      >
        <Button
          onClick={handleKeyboardClick}
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
          tone={tone}
        />
      </Tooltip>
    </div>
  )
}
