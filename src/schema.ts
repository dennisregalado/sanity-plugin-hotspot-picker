import React from 'react'
import {
  defineArrayMember,
  defineField,
  defineType,
  type FieldDefinition,
  type ObjectFieldProps,
  type ObjectInputProps,
  type PreviewValue,
} from 'sanity'

import {HotspotObjectInput} from './HotspotObjectInput'
import type {HotspotPickerPluginOptions} from './types'

function ImageField(props: ObjectFieldProps): React.ReactElement {
  return React.createElement(React.Fragment, null, props.children)
}

/** Default name of the object type the plugin registers. */
export const DEFAULT_TYPE_NAME = 'hotspotImage'

/**
 * The hidden `x` and `y` fields a spot needs (percentages of the image, set by dragging).
 * Spread them into the array member's `fields`.
 */
export function hotspotFields(): FieldDefinition[] {
  const coordinate = (name: 'x' | 'y') =>
    defineField({
      name,
      type: 'number',
      readOnly: true,
      hidden: true,
      initialValue: 50,
      validation: (rule) => rule.required().min(0).max(100),
    })
  return [coordinate('x'), coordinate('y')]
}

/**
 * The object type: an `image` and the `items` placed on it. Each item has a `reference`, the
 * plugin's extra `fields`, and its `x`/`y` position.
 */
export function createHotspotType(
  options: HotspotPickerPluginOptions = {},
): ReturnType<typeof defineType> {
  const {reference, image, item} = options
  const referenceField = reference
    ? [
        defineField({
          title: 'Reference',
          validation: (rule) => rule.required(),
          ...reference,
          name: 'reference',
          type: 'reference',
        } as FieldDefinition),
      ]
    : []

  return defineType({
    name: options.name ?? DEFAULT_TYPE_NAME,
    title: options.title ?? 'Hotspot image',
    type: 'object',
    components: {
      input: (props: ObjectInputProps) =>
        React.createElement(HotspotObjectInput, {...props, defaults: options}),
    },
    fields: [
      defineField({
        options: {hotspot: true},
        ...image,
        // Just the input: the object field's own title stands for it, like the search listing.
        components: {field: ImageField, ...image?.components},
        name: 'image',
        title: image?.title ?? 'Image',
        type: 'image',
      } as FieldDefinition),
      defineField({
        name: 'items',
        title: item?.listTitle ?? 'Items',
        type: 'array',
        options: {hotspotPicker: true},
        of: [
          defineArrayMember({
            name: item?.name ?? 'spot',
            title: item?.title ?? reference?.title ?? 'Spot',
            type: 'object',
            icon: item?.icon,
            fields: [...referenceField, ...(item?.fields ?? []), ...hotspotFields()],
            preview: item?.preview ?? {
              select: {title: 'reference.title'},
              prepare: ({title}: {title?: string}) => ({title: title || 'Untitled'}),
            },
          }),
        ],
      }),
    ],
    preview: {
      select: {media: 'image', items: 'items'},
      prepare: ({media, items}: {media?: PreviewValue['media']; items?: unknown[]}) => {
        const count = items?.length ?? 0
        return {title: count === 1 ? '1 item' : `${count} items`, media}
      },
    },
  })
}
