import {EditIcon} from '@sanity/icons/Edit'
import {Box, Button, Card, Stack, Text} from '@sanity/ui'
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

import {HotspotFrame} from './HotspotFrame'
import {useInvalidKeys} from './HotspotPickerInput'
import type {HotspotImageValue, HotspotItem, HotspotPickerOptions} from './types'

/** Set by the object input: its `items` field leaves the image to it. `null` outside it. */
export const HotspotObjectContext = createContext<{editing: boolean} | null>(null)

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
  const context = useMemo(() => ({editing}), [editing])

  const itemsMember = props.members.find(
    (member) => member.kind === 'field' && member.name === 'items',
  )
  const itemsField =
    itemsMember?.kind === 'field' ? (itemsMember.field as ArrayOfObjectsFormNode) : undefined
  const invalidKeys = useInvalidKeys(itemsField?.members ?? NO_MEMBERS)
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
      // Spots are stored relative to the cropped image, so a new crop moves them all.
      if (editing && isImage && hasImage && value?.items?.length) {
        return (
          <Stack gap={3}>
            <Card padding={3} radius={2} tone="caution" border>
              <Text size={1}>
                Spots are positioned on the cropped image, so changing the crop moves them.
              </Text>
            </Card>
            {parentRenderInput(inputProps)}
          </Stack>
        )
      }
      if (editing || !isImage || !itemType) return parentRenderInput(inputProps)
      return (
        <HotspotFrame
          image={value?.image as ImageValue | undefined}
          items={value?.items as HotspotItem[] | undefined}
          arrayPath={arrayPath}
          itemType={itemType}
          invalidKeys={invalidKeys}
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
      hasImage,
      path,
      itemType,
      parentRenderInput,
      value,
      arrayPath,
      invalidKeys,
      readOnly,
      defaults,
      renderPreview,
      handlePatch,
      openItem,
    ],
  )

  return (
    <HotspotObjectContext.Provider value={context}>
      <Stack gap={5} style={{position: 'relative'}}>
        {hasImage && (
          // In the object field's header, level with its title: the header ends a gap above the
          // input, and its actions (field actions, comments) take the right end, so leave room.
          <Box style={{position: 'absolute', bottom: '100%', right: 58, marginBottom: 8}}>
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
                selected={isEditing}
                aria-label="Edit image"
              />
            </Tooltip>
          </Box>
        )}
        {props.renderDefault({...props, renderInput})}
      </Stack>
    </HotspotObjectContext.Provider>
  )
}
