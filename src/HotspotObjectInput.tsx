import {CheckmarkIcon} from '@sanity/icons/Checkmark'
import {EditIcon} from '@sanity/icons/Edit'
import {Box, Button, Stack, Text} from '@sanity/ui'
import {Tooltip} from '@sanity/ui/tooltip'
import {createContext, type ReactNode, useCallback, useMemo, useState} from 'react'
import {
  type ArrayOfObjectsFormNode,
  type ArraySchemaType,
  type FormPatch,
  type ImageValue,
  type ObjectInputProps,
  type ObjectSchemaType,
  PatchEvent,
  type RenderInputCallback,
  useFormCallbacks,
} from 'sanity'

import {type HoverStore, useActiveKeys, useHoverStore} from './highlight'
import {HotspotFrame} from './HotspotFrame'
import {useInvalidKeys} from './HotspotPickerInput'
import type {HotspotImageValue, HotspotItem, HotspotPickerOptions} from './types'

/**
 * Set by the object input: its `items` field leaves the image to it, and reports the row hovered
 * in its list to `hoverStore`. `null` outside it.
 */
export const HotspotObjectContext = createContext<{
  editing: boolean
  hoverStore: HoverStore
} | null>(null)

const NO_MEMBERS: ArrayOfObjectsFormNode['members'] = []

export type HotspotObjectInputProps = ObjectInputProps & {defaults?: HotspotPickerOptions}

/**
 * The plugin's object input. With an image, the spot picker sits where the image field goes; the
 * edit button swaps it for the native image input. Without an image, the native input shows.
 */
export function HotspotObjectInput(props: HotspotObjectInputProps): ReactNode {
  const {path, onChange, renderPreview, readOnly, defaults} = props
  const value = props.value as HotspotImageValue | undefined
  const hasImage = Boolean(value?.image?.asset?._ref)
  const [isEditing, setIsEditing] = useState(false)
  const editing = isEditing || !hasImage
  const handleEditToggle = useCallback(() => setIsEditing((current) => !current), [])
  const hoverStore = useHoverStore()
  const context = useMemo(() => ({editing, hoverStore}), [editing, hoverStore])

  const itemsMember = props.members.find(
    (member) => member.kind === 'field' && member.name === 'items',
  )
  const itemsField =
    itemsMember?.kind === 'field' ? (itemsMember.field as ArrayOfObjectsFormNode) : undefined
  const invalidKeys = useInvalidKeys(itemsField?.members ?? NO_MEMBERS)
  const activeKeys = useActiveKeys(itemsField?.members ?? NO_MEMBERS)
  const itemsType = props.schemaType.fields.find((field) => field.name === 'items')?.type as
    ArraySchemaType | undefined
  const itemType = itemsType?.of[0] as ObjectSchemaType | undefined
  const arrayPath = useMemo(() => [...path, 'items'], [path])

  const {onPathOpen} = useFormCallbacks()
  const handlePatch = useCallback(
    (patches: FormPatch[]) => onChange(PatchEvent.from(patches).prefixAll('items')),
    [onChange],
  )
  const openItem = useCallback(
    (key: string) => onPathOpen([...arrayPath, {_key: key}]),
    [onPathOpen, arrayPath],
  )

  // Outside edit mode the image field's input is the spot picker, in the image's place.
  const parentRenderInput = props.renderInput
  const renderInput: RenderInputCallback = useCallback(
    (inputProps) => {
      const isImage =
        inputProps.path.length === path.length + 1 && inputProps.path[path.length] === 'image'
      if (editing || !isImage || !itemType) return parentRenderInput(inputProps)
      return (
        <HotspotFrame
          image={value?.image as ImageValue | undefined}
          items={value?.items as HotspotItem[] | undefined}
          arrayPath={arrayPath}
          itemType={itemType}
          invalidKeys={invalidKeys}
          activeKeys={activeKeys}
          hoverStore={hoverStore}
          readOnly={readOnly}
          options={defaults ?? {}}
          renderPreview={renderPreview}
          onPatch={handlePatch}
          onOpen={openItem}
        />
      )
    },
    [
      editing,
      path,
      itemType,
      parentRenderInput,
      value,
      arrayPath,
      invalidKeys,
      activeKeys,
      hoverStore,
      readOnly,
      defaults,
      renderPreview,
      handlePatch,
      openItem,
    ],
  )

  return (
    <HotspotObjectContext.Provider value={context}>
      <Stack gap={5}>
        {hasImage && (
          <Box style={{position: 'absolute', top: 0, right: 0}}>
            {isEditing ? (
              // While editing, a labelled button returns to the spots.
              <Button
                mode="ghost"
                tone="primary"
                icon={CheckmarkIcon}
                text="Done"
                fontSize={1}
                padding={2}
                onClick={handleEditToggle}
                aria-label="Done editing image"
              />
            ) : (
              <Tooltip
                animate
                delay={5}
                placement="top"
                content={
                  <Text size={1} weight="medium">
                    Edit image
                  </Text>
                }
                portal
              >
                <Button
                  mode="bleed"
                  icon={EditIcon}
                  padding={2}
                  onClick={handleEditToggle}
                  aria-label="Edit image"
                />
              </Tooltip>
            )}
          </Box>
        )}
        {props.renderDefault({...props, renderInput})}
      </Stack>
    </HotspotObjectContext.Provider>
  )
}
