import type {Placement} from '@sanity/ui'
import type {ComponentType} from 'react'
import type {ArrayOfObjectsInputProps, ArraySchemaType} from 'sanity'

/** One array item placed on the image. `x`/`y` are percentages (0–100) of the image. */
export type HotspotItem<Fields = {[key: string]: unknown}> = {
  _key: string
  _type: string
  x?: number
  y?: number
} & Fields

/** Options shared by the plugin and each field (a field's options win). */
export interface HotspotPickerOptions {
  /**
   * Field holding the image the spots sit on, relative to the array's parent object. Use dots for
   * nested fields (`media.image`). Defaults to `image`.
   */
  imagePath?: string
  /** Width of the preview image requested from the Sanity CDN. Defaults to `1200`. */
  imageWidth?: number
  /** Icon on each spot. Defaults to a pin. */
  icon?: ComponentType
  /** Where a spot's preview tooltip opens, from the item's value. Defaults to automatic. */
  tooltipPlacement?: (item: HotspotItem) => Placement | undefined
}

/** Options for the plugin (argument to `hotspotPicker`). */
export type HotspotPickerPluginOptions = Omit<HotspotPickerOptions, 'imagePath'>

export type HotspotArraySchemaType = Omit<ArraySchemaType, 'options'> & {
  options?: ArraySchemaType['options'] & {hotspotPicker?: HotspotPickerOptions | true}
}

export type HotspotPickerInputProps = ArrayOfObjectsInputProps<HotspotItem, HotspotArraySchemaType>

declare module 'sanity' {
  interface ArrayOptions {
    /** Place this array's items as spots on an image. `true` uses the defaults. */
    hotspotPicker?: HotspotPickerOptions | true
  }
}
