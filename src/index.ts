import React from 'react'
import {
  type ArrayOfObjectsInputProps,
  definePlugin,
  type InputProps,
  isArrayOfObjectsSchemaType,
} from 'sanity'

import {HotspotPickerInput} from './HotspotPickerInput'
import {createHotspotType} from './schema'
import type {HotspotPickerInputProps, HotspotPickerPluginOptions} from './types'

/**
 * Registers the `hotspotImage` object type: an `image` and an array of `items`, each a draggable
 * spot on the image with a `reference` and an `x`/`y` position. Also turns any array field with
 * `options.hotspotPicker` into a spot picker.
 *
 * @example
 * ```ts
 * // sanity.config.ts
 * plugins: [hotspotPicker({reference: {title: 'Product', to: [{type: 'product'}]}})]
 *
 * // schema
 * defineField({name: 'shoppable', type: 'hotspotImage'})
 * ```
 */
export const hotspotPicker = definePlugin<HotspotPickerPluginOptions | void>((options) => {
  const defaults = options ?? undefined
  return {
    name: 'hotspot-picker',
    schema: {types: [createHotspotType(defaults)]},
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
 * Use the input without the plugin, as a field's `components.input`. Set the field's
 * `options.hotspotPicker` (or `true`) for its options.
 */
export function HotspotPicker(props: ArrayOfObjectsInputProps): React.ReactElement {
  return React.createElement(HotspotPickerInput, props as unknown as HotspotPickerInputProps)
}

export {HotspotPickerInput}
export {DEFAULT_TYPE_NAME, hotspotFields} from './schema'
export type {
  HotspotArraySchemaType,
  HotspotImageValue,
  HotspotItem,
  HotspotPickerInputProps,
  HotspotPickerOptions,
  HotspotPickerPluginOptions,
} from './types'
