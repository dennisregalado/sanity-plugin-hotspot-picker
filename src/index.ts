import React from 'react'
import {
  type ArrayOfObjectsInputProps,
  defineField,
  definePlugin,
  type FieldDefinition,
  type InputProps,
  isArrayOfObjectsSchemaType,
} from 'sanity'

import {HotspotPickerInput} from './HotspotPickerInput'
import type {HotspotPickerInputProps, HotspotPickerPluginOptions} from './types'

/**
 * Turns any array field with `options.hotspotPicker` into a hotspot picker: each item is a
 * draggable spot on a sibling image field, with its position stored as `x`/`y` percentages.
 *
 * @example
 * ```ts
 * // sanity.config.ts
 * plugins: [hotspotPicker()]
 *
 * // schema
 * defineField({
 *   name: 'spots',
 *   type: 'array',
 *   options: {hotspotPicker: {imagePath: 'image'}},
 *   of: [defineArrayMember({type: 'object', name: 'spot', fields: [...hotspotFields(), ...]})],
 * })
 * ```
 */
export const hotspotPicker = definePlugin<HotspotPickerPluginOptions | void>((options) => {
  const defaults = options ?? undefined
  return {
    name: 'hotspot-picker',
    form: {
      components: {
        input: (props: InputProps) => {
          if (
            isArrayOfObjectsSchemaType(props.schemaType) &&
            props.schemaType.options?.hotspotPicker
          ) {
            return React.createElement(HotspotPickerInput, {
              ...(props as unknown as HotspotPickerInputProps),
              defaults,
            })
          }
          return props.renderDefault(props)
        },
      },
    },
  }
})

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
 * Use the input without the plugin, as a field's `components.input`. Set the field's
 * `options.hotspotPicker` (or `true`) for its options.
 */
export function HotspotPicker(props: ArrayOfObjectsInputProps): React.ReactElement {
  return React.createElement(HotspotPickerInput, props as unknown as HotspotPickerInputProps)
}

export {HotspotPickerInput}
export type {
  HotspotArraySchemaType,
  HotspotItem,
  HotspotPickerInputProps,
  HotspotPickerOptions,
  HotspotPickerPluginOptions,
} from './types'
