import {getImageDimensions} from '@sanity/asset-utils'
import {createImageUrlBuilder} from '@sanity/image-url'
import {Card, Skeleton, Text} from '@sanity/ui'
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type FormPatch,
  type ImageValue,
  insert,
  type ObjectSchemaType,
  type Path,
  type RenderPreviewCallback,
  set,
  setIfMissing,
  unset,
  useClient,
} from 'sanity'

import {type HoverStore, useHoveredKey} from './highlight'
import {Spot} from './Spot'
import type {HotspotItem, HotspotPickerOptions} from './types'
import {randomKey, toPercent} from './utils'

/** Largest preview width requested by default: 1200 CSS px on a 2× screen. */
export const DEFAULT_IMAGE_WIDTH = 2400

/** Widths offered to the browser in the preview's `srcset`. */
const SRCSET_WIDTHS = [400, 600, 800, 1000, 1200, 1600, 2000, 2400, 3200, 4000]

/** Very tall images are capped at this height (the width follows, keeping the aspect ratio). */
const MAX_FRAME_HEIGHT = 'min(70vh, 720px)'

/** Offset (percent) of a duplicated spot from the original. */
const DUPLICATE_OFFSET = 3

export interface HotspotFrameProps {
  image: ImageValue | undefined
  items: HotspotItem[] | undefined
  /** Path of the items array, for opening items and their references. */
  arrayPath: Path
  itemType: ObjectSchemaType
  invalidKeys: Set<string>
  /** Keys of items open or focused in the form: their spots are highlighted. */
  activeKeys?: Set<string>
  /** The item hovered in the array list: its spot is highlighted. */
  hoverStore?: HoverStore
  readOnly?: boolean
  options: HotspotPickerOptions
  renderPreview: RenderPreviewCallback
  /** Patches relative to the items array. */
  onPatch: (patches: FormPatch[]) => void
  onOpen: (key: string) => void
}

export interface ImagePreview {
  /** Fallback URL (the smallest offered width that's at least 800px, or the largest). */
  url: string
  /** `srcset` of the cropped image at several widths, for the browser to pick by density. */
  srcSet: string
  /** Cropped width / height. */
  aspectRatio: number
  /** The image's alt text, from an `alt` field on the image, if any. */
  alt: string
}

/** The preview image's URLs and its (cropped) aspect ratio, or `null` without an image. */
export function useImagePreview(
  image: ImageValue | undefined,
  maxWidth = DEFAULT_IMAGE_WIDTH,
): ImagePreview | null {
  const client = useClient({apiVersion: '2025-01-01'})
  return useMemo(() => {
    const ref = image?.asset?._ref
    if (!ref) return null
    const dimensions = getImageDimensions(ref)
    const crop = image.crop
    const croppedWidth = dimensions.width * (1 - (crop?.left ?? 0) - (crop?.right ?? 0))
    const croppedHeight = dimensions.height * (1 - (crop?.top ?? 0) - (crop?.bottom ?? 0))
    // Never upscale: the largest width offered is the cropped image's own (or `maxWidth`).
    const largest = Math.max(1, Math.round(Math.min(maxWidth, croppedWidth)))
    const widths = [...SRCSET_WIDTHS.filter((w) => w < largest), largest]
    const builder = createImageUrlBuilder(client).image(image)
    const urlAt = (w: number) => builder.width(w).url()
    return {
      url: urlAt(widths.find((w) => w >= 800) ?? largest),
      srcSet: widths.map((w) => `${urlAt(w)} ${w}w`).join(', '),
      aspectRatio: croppedWidth / croppedHeight,
      alt: typeof image.alt === 'string' ? image.alt : '',
    }
  }, [image, client, maxWidth])
}

/** The element's rendered width in CSS pixels, kept up to date. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    setWidth(element.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

const NO_KEYS = new Set<string>()

/**
 * The image with its spots. Click the image to add a spot (its item opens), drag a spot to move
 * it, click it to edit its item. The preview is cropped like the frontend's, so positions are
 * relative to the crop: the frame is exactly the size of the image, and spots are percentages of it.
 */
export function HotspotFrame(props: HotspotFrameProps): ReactNode {
  const {image, items, arrayPath, itemType, invalidKeys, readOnly, options, renderPreview} = props
  const {activeKeys = NO_KEYS, hoverStore, onPatch, onOpen} = props
  const preview = useImagePreview(image, options.imageWidth)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const frameWidth = useWidth(frameRef)
  const hoveredKey = useHoveredKey(hoverStore)

  // Skeleton until the image (re)loads; a new srcset for the same image keeps the old one shown.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const imageKey = image?.asset?._ref ?? ''
  const loaded = loadedUrl === imageKey
  const handleLoad = useCallback(() => setLoadedUrl(imageKey), [imageKey])
  useLayoutEffect(() => {
    // An image from the cache can finish before React attaches `onLoad`.
    if (imageRef.current?.complete && imageRef.current.naturalWidth) setLoadedUrl(imageKey)
  }, [imageKey, frameWidth])

  // Only a press that starts and ends on the image adds a spot: not the click that follows a
  // drag cancelled with Escape (which ends on the frame once the spot lets go of the pointer).
  const pressedImage = useRef(false)
  const isImage = useCallback(
    (event: {target: EventTarget; currentTarget: EventTarget}) =>
      event.target === event.currentTarget || event.target === imageRef.current,
    [],
  )
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pressedImage.current = isImage(event)
    },
    [isImage],
  )

  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (readOnly || !pressedImage.current || !isImage(event)) return
      pressedImage.current = false
      const rect = event.currentTarget.getBoundingClientRect()
      const item: HotspotItem = {
        _key: randomKey(),
        _type: itemType.name,
        x: toPercent(((event.clientX - rect.left) / rect.width) * 100),
        y: toPercent(((event.clientY - rect.top) / rect.height) * 100),
      }
      onPatch([setIfMissing([]), insert([item], 'after', [-1])])
      // Open the new item, like the Studio's own "Add item".
      onOpen(item._key)
    },
    [readOnly, isImage, onPatch, onOpen, itemType.name],
  )

  const handleMove = useCallback(
    (key: string, x: number, y: number) => {
      onPatch([set(x, [{_key: key}, 'x']), set(y, [{_key: key}, 'y'])])
    },
    [onPatch],
  )

  const handleRemove = useCallback((key: string) => onPatch([unset([{_key: key}])]), [onPatch])

  const handleDuplicate = useCallback(
    (key: string) => {
      const original = items?.find((item) => item._key === key)
      if (!original) return
      const offset = (value = 50) =>
        toPercent(value + (value > 100 - DUPLICATE_OFFSET ? -DUPLICATE_OFFSET : DUPLICATE_OFFSET))
      const copy: HotspotItem = {
        ...original,
        _key: randomKey(),
        x: offset(original.x),
        y: offset(original.y),
      }
      onPatch([insert([copy], 'after', [{_key: key}])])
    },
    [items, onPatch],
  )

  if (!preview) return null
  const isEmpty = !items?.length

  return (
    <Card border radius={2} overflow="hidden">
      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        onClick={handleImageClick}
        style={{
          position: 'relative',
          aspectRatio: preview.aspectRatio,
          width: '100%',
          maxWidth: `calc(${MAX_FRAME_HEIGHT} * ${preview.aspectRatio})`,
          margin: '0 auto',
          cursor: readOnly ? 'default' : 'crosshair',
        }}
      >
        {!loaded && (
          <Skeleton
            animated
            radius={0}
            style={{position: 'absolute', inset: 0, height: '100%', pointerEvents: 'none'}}
          />
        )}
        {frameWidth > 0 && (
          <img
            key={imageKey}
            ref={imageRef}
            src={preview.url}
            srcSet={preview.srcSet}
            sizes={`${Math.ceil(frameWidth)}px`}
            alt={preview.alt}
            draggable={false}
            onLoad={handleLoad}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 150ms ease',
              userSelect: 'none',
            }}
          />
        )}
        {isEmpty && !readOnly && loaded && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 12,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(17, 18, 22, 0.72)',
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            <Text size={1} weight="medium" style={{color: 'inherit'}}>
              Click the image to add a spot
            </Text>
          </div>
        )}
        {items?.map((spot, index) => (
          <Spot
            key={spot._key}
            value={spot}
            itemPath={[...arrayPath, {_key: spot._key}]}
            frameRef={frameRef}
            schemaType={itemType}
            renderPreview={renderPreview}
            invalid={invalidKeys.has(spot._key)}
            readOnly={readOnly}
            icon={options.icon}
            placement={options.tooltipPlacement?.(spot)}
            number={options.numbered ? index + 1 : undefined}
            active={activeKeys.has(spot._key) || hoveredKey === spot._key}
            onMove={handleMove}
            onOpen={onOpen}
            onRemove={handleRemove}
            onDuplicate={handleDuplicate}
          />
        ))}
      </div>
    </Card>
  )
}
