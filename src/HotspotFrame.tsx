import {getImageDimensions} from '@sanity/asset-utils'
import {createImageUrlBuilder} from '@sanity/image-url'
import {Card} from '@sanity/ui'
import {type MouseEvent, type ReactNode, useCallback, useMemo, useRef} from 'react'
import {
  type FormPatch,
  type ImageValue,
  insert,
  type ObjectSchemaType,
  type Path,
  type RenderPreviewCallback,
  set,
  setIfMissing,
  useClient,
  useResolveInitialValueForType,
} from 'sanity'

import {Spot} from './Spot'
import type {HotspotItem, HotspotPickerOptions} from './types'
import {randomKey, toPercent} from './utils'

export const DEFAULT_IMAGE_WIDTH = 1200

export interface HotspotFrameProps {
  image: ImageValue | undefined
  items: HotspotItem[] | undefined
  /** Path of the items array, for opening items and their references. */
  arrayPath: Path
  itemType: ObjectSchemaType
  invalidKeys: Set<string>
  readOnly?: boolean
  options: HotspotPickerOptions
  renderPreview: RenderPreviewCallback
  /** Patches relative to the items array. */
  onPatch: (patches: FormPatch[]) => void
  onOpen: (key: string) => void
}

/** The preview image's URL and its (cropped) aspect ratio, or `null` without an image. */
export function useImagePreview(
  image: ImageValue | undefined,
  width = DEFAULT_IMAGE_WIDTH,
): {url: string; aspectRatio: number} | null {
  const client = useClient({apiVersion: '2025-01-01'})
  return useMemo(() => {
    const ref = image?.asset?._ref
    if (!ref) return null
    const dimensions = getImageDimensions(ref)
    const crop = image.crop
    const croppedWidth = dimensions.width * (1 - (crop?.left ?? 0) - (crop?.right ?? 0))
    const croppedHeight = dimensions.height * (1 - (crop?.top ?? 0) - (crop?.bottom ?? 0))
    return {
      url: createImageUrlBuilder(client).image(image).width(width).url(),
      aspectRatio: croppedWidth / croppedHeight,
    }
  }, [image, client, width])
}

/**
 * The image with its spots. Click the image to add a spot, drag a spot to move it, click it to
 * edit its item. The preview is cropped like the frontend's, so positions are relative to the crop.
 */
export function HotspotFrame(props: HotspotFrameProps): ReactNode {
  const {image, items, arrayPath, itemType, invalidKeys, readOnly, options, renderPreview} = props
  const {onPatch, onOpen} = props
  const preview = useImagePreview(image, options.imageWidth)
  const frameRef = useRef<HTMLDivElement | null>(null)

  // New spots get the item type's initial values, like the Studio's own "Add item".
  const resolveInitialValue = useResolveInitialValueForType()
  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (readOnly || event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      const x = toPercent(((event.clientX - rect.left) / rect.width) * 100)
      const y = toPercent(((event.clientY - rect.top) / rect.height) * 100)
      const proto = {_key: randomKey(), _type: itemType.name}
      resolveInitialValue(itemType, proto)
        .catch((error: unknown) => {
          console.error(`Could not resolve initial value for type: ${itemType.name}`, error)
          return undefined
        })
        .then((initial: Record<string, unknown> | undefined) => {
          const item: HotspotItem = {...initial, ...proto, x, y}
          onPatch([setIfMissing([]), insert([item], 'after', [-1])])
        })
    },
    [readOnly, onPatch, itemType, resolveInitialValue],
  )

  const handleMove = useCallback(
    (key: string, x: number, y: number) => {
      onPatch([set(x, [{_key: key}, 'x']), set(y, [{_key: key}, 'y'])])
    },
    [onPatch],
  )

  if (!preview) return null

  return (
    <Card border radius={2} overflow="hidden">
      <div
        ref={frameRef}
        onClick={handleImageClick}
        style={{
          position: 'relative',
          aspectRatio: preview.aspectRatio,
          backgroundImage: `url(${preview.url})`,
          backgroundSize: '100% 100%',
          cursor: readOnly ? 'default' : 'crosshair',
        }}
      >
        {items?.map((spot) => (
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
            onMove={handleMove}
            onOpen={onOpen}
          />
        ))}
      </div>
    </Card>
  )
}
