import {getImageDimensions} from '@sanity/asset-utils'
import {AddIcon} from '@sanity/icons/Add'
import {createImageUrlBuilder} from '@sanity/image-url'
import {Button, Card, Flex, Text} from '@sanity/ui'
import {type MouseEvent, type ReactNode, useCallback, useMemo, useRef} from 'react'
import {
  type ImageValue,
  type InputProps,
  insert,
  type ObjectSchemaType,
  PatchEvent,
  set,
  setIfMissing,
  useClient,
  useFormValue,
} from 'sanity'

import {Spot} from './Spot'
import type {HotspotItem, HotspotPickerInputProps, HotspotPickerOptions} from './types'
import {randomKey, resolveImagePath, toPercent} from './utils'

const DEFAULT_IMAGE_WIDTH = 1200

/** The Studio's add button is replaced by ours, which also opens the new item. */
const hideArrayFunctions = () => null

/** Resolve the field's options over the plugin's defaults. */
function useHotspotOptions(
  props: HotspotPickerInputProps,
  defaults?: HotspotPickerOptions,
): Required<Pick<HotspotPickerOptions, 'imagePath' | 'imageWidth'>> & HotspotPickerOptions {
  const fieldOptions = props.schemaType.options?.hotspotPicker
  return {
    ...defaults,
    ...(typeof fieldOptions === 'object' ? fieldOptions : {}),
    imagePath:
      (typeof fieldOptions === 'object' && fieldOptions.imagePath) ||
      defaults?.imagePath ||
      'image',
    imageWidth:
      (typeof fieldOptions === 'object' && fieldOptions.imageWidth) ||
      defaults?.imageWidth ||
      DEFAULT_IMAGE_WIDTH,
  }
}

/**
 * Array input that places each item as a draggable spot on an image field. Click the image to
 * add a spot, drag a spot to move it, click a spot to edit its item. The list below the image is
 * the Studio's own array input, so reordering, removing and editing work as usual.
 */
export function HotspotPickerInput(
  props: HotspotPickerInputProps & {defaults?: HotspotPickerOptions},
): ReactNode {
  const {value, onChange, schemaType, renderPreview, path, onItemAppend, onItemOpen} = props
  const {members, readOnly, defaults} = props
  const options = useHotspotOptions(props, defaults)
  const itemType = schemaType.of[0] as ObjectSchemaType

  const client = useClient({apiVersion: '2025-01-01'})
  const imagePath = useMemo(
    () => resolveImagePath(path, options.imagePath),
    [path, options.imagePath],
  )
  const image = useFormValue(imagePath) as ImageValue | undefined

  // The preview is cropped like the frontend's, so spot positions are relative to the crop.
  const preview = useMemo(() => {
    const ref = image?.asset?._ref
    if (!ref) return null
    const {width, height} = getImageDimensions(ref)
    const crop = image.crop
    const croppedWidth = width * (1 - (crop?.left ?? 0) - (crop?.right ?? 0))
    const croppedHeight = height * (1 - (crop?.top ?? 0) - (crop?.bottom ?? 0))
    return {
      url: createImageUrlBuilder(client).image(image).width(options.imageWidth).url(),
      aspectRatio: croppedWidth / croppedHeight,
    }
  }, [image, client, options.imageWidth])

  const frameRef = useRef<HTMLDivElement | null>(null)

  const invalidKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const member of members) {
      if (member.kind === 'item' && member.item.validation.some((v) => v.level === 'error')) {
        keys.add(member.key)
      }
    }
    return keys
  }, [members])

  const openItem = useCallback(
    (key: string) => onItemOpen([...path, {_key: key}]),
    [onItemOpen, path],
  )

  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (readOnly || event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      const item: HotspotItem = {
        _key: randomKey(),
        _type: itemType.name,
        x: toPercent(((event.clientX - rect.left) / rect.width) * 100),
        y: toPercent(((event.clientY - rect.top) / rect.height) * 100),
      }
      onChange(PatchEvent.from([setIfMissing([]), insert([item], 'after', [-1])]))
    },
    [readOnly, onChange, itemType.name],
  )

  const handleMove = useCallback(
    (key: string, x: number, y: number) => {
      onChange(PatchEvent.from([set(x, [{_key: key}, 'x']), set(y, [{_key: key}, 'y'])]))
    },
    [onChange],
  )

  const addItem = useCallback(() => {
    const key = randomKey()
    onItemAppend({_key: key, _type: itemType.name, x: 50, y: 50})
    openItem(key)
  }, [onItemAppend, itemType.name, openItem])

  return (
    <Flex direction="column" gap={2}>
      {preview ? (
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
            {value?.map((spot) => (
              <Spot
                key={spot._key}
                value={spot}
                frameRef={frameRef}
                schemaType={itemType}
                renderPreview={renderPreview}
                invalid={invalidKeys.has(spot._key)}
                readOnly={readOnly}
                icon={options.icon}
                placement={options.tooltipPlacement?.(spot)}
                onMove={handleMove}
                onOpen={openItem}
              />
            ))}
          </div>
        </Card>
      ) : (
        <Card padding={3} radius={2} tone="caution" border>
          <Text size={1}>Add an image first to place spots on it.</Text>
        </Card>
      )}
      {props.renderDefault({...props, arrayFunctions: hideArrayFunctions} as unknown as InputProps)}
      {!readOnly && (
        <Button
          onClick={addItem}
          icon={AddIcon}
          text={`Add ${itemType.title?.toLowerCase() ?? 'spot'}`}
          mode="bleed"
          padding={2}
          tone="suggest"
        />
      )}
    </Flex>
  )
}
