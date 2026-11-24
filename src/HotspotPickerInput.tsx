import {Card, Flex, Text} from '@sanity/ui'
import {type ReactNode, useCallback, useContext, useEffect, useMemo} from 'react'
import {
  type ArrayOfObjectsMember,
  type FormPatch,
  type ImageValue,
  type InputProps,
  type ObjectSchemaType,
  PatchEvent,
  useFormValue,
} from 'sanity'

import {useActiveKeys, useHoveredKey, useHoverRenderItem, useHoverStore} from './highlight'
import {DEFAULT_IMAGE_WIDTH, HotspotFrame} from './HotspotFrame'
import {HotspotObjectContext} from './HotspotObjectInput'
import type {HotspotPickerInputProps, HotspotPickerOptions} from './types'
import {resolveImagePath} from './utils'

/** Keys of items with error-level validation (their spots show a warning). */
export function useInvalidKeys(members: ArrayOfObjectsMember[]): Set<string> {
  return useMemo(() => {
    const keys = new Set<string>()
    for (const member of members) {
      if (member.kind === 'item' && member.item.validation.some((v) => v.level === 'error')) {
        keys.add(member.key)
      }
    }
    return keys
  }, [members])
}

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
 * Array input that places each item as a draggable spot on an image field. The list below the
 * image is the Studio's own array input, so adding, reordering, removing and editing work as usual.
 * Inside the plugin's object type, the object input shows the image instead (above this field).
 */
export function HotspotPickerInput(
  props: HotspotPickerInputProps & {defaults?: HotspotPickerOptions},
): ReactNode {
  const objectContext = useContext(HotspotObjectContext)
  if (objectContext) return <HotspotList {...props} hoverStore={objectContext.hoverStore} />
  return <StandaloneHotspotPicker {...props} />
}

/** The Studio's own array list, reporting the hovered row so its spot can be highlighted. */
function HotspotList(
  props: HotspotPickerInputProps & {hoverStore: ReturnType<typeof useHoverStore>},
): ReactNode {
  const {hoverStore, ...rest} = props
  const renderItem = useHoverRenderItem(rest.renderItem, hoverStore)
  // Rows removed while hovered never get `mouseleave`: forget them.
  const hoveredKey = useHoveredKey(hoverStore)
  const hoveredRemoved = Boolean(hoveredKey && !rest.value?.some((i) => i._key === hoveredKey))
  useEffect(() => {
    if (hoveredRemoved) hoverStore.set(null)
  }, [hoveredRemoved, hoverStore])
  return rest.renderDefault({...rest, renderItem} as unknown as InputProps)
}

function StandaloneHotspotPicker(
  props: HotspotPickerInputProps & {defaults?: HotspotPickerOptions},
): ReactNode {
  const {value, onChange, schemaType, renderPreview, path, onItemOpen, members, readOnly} = props
  const options = useHotspotOptions(props, props.defaults)
  const itemType = schemaType.of[0] as ObjectSchemaType
  const imagePath = useMemo(
    () => resolveImagePath(path, options.imagePath),
    [path, options.imagePath],
  )
  const image = useFormValue(imagePath) as ImageValue | undefined
  const invalidKeys = useInvalidKeys(members)
  const activeKeys = useActiveKeys(members)
  const hoverStore = useHoverStore()

  const handlePatch = useCallback(
    (patches: FormPatch[]) => onChange(PatchEvent.from(patches)),
    [onChange],
  )
  const openItem = useCallback(
    (key: string) => onItemOpen([...path, {_key: key}]),
    [onItemOpen, path],
  )

  return (
    <Flex direction="column" gap={2}>
      {image?.asset?._ref ? (
        <HotspotFrame
          image={image}
          items={value}
          arrayPath={path}
          itemType={itemType}
          invalidKeys={invalidKeys}
          activeKeys={activeKeys}
          hoverStore={hoverStore}
          readOnly={readOnly}
          options={options}
          renderPreview={renderPreview}
          onPatch={handlePatch}
          onOpen={openItem}
        />
      ) : (
        <Card padding={3} radius={2} tone="caution" border>
          <Text size={1}>Add an image first to place spots on it.</Text>
        </Card>
      )}
      <HotspotList {...props} hoverStore={hoverStore} />
    </Flex>
  )
}
