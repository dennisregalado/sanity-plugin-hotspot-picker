import type {Placement} from '@sanity/ui'
import type {ComponentType} from 'react'
import type {
  ArrayOfObjectsInputProps,
  ArraySchemaType,
  FieldDefinition,
  ImageDefinition,
  PreviewConfig,
  ReferenceDefinition,
} from 'sanity'

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
export interface HotspotPickerPluginOptions extends Omit<HotspotPickerOptions, 'imagePath'> {
  /** Name of the object type the plugin registers. Defaults to `hotspotImage`. */
  name?: string
  /** Title of the object type. Defaults to `Hotspot image`. */
  title?: string
  /** Overrides for the `image` field (`fields`, `options`, `title`...). Hotspot/crop is on. */
  image?: Partial<Omit<ImageDefinition, 'name' | 'type'>>
  /**
   * Each item's `reference` field; `to` is required (e.g. a Product reference to the `product`
   * type). Required by default. The spot's popover previews the referenced document. Leave out
   * for items without a reference.
   */
  reference?: Omit<ReferenceDefinition, 'name' | 'type'>
  /** The items in the `items` array. */
  item?: {
    /** Type name of each item. Defaults to `spot`. */
    name?: string
    /** Title of each item. Defaults to the reference's title, else `Spot`. */
    title?: string
    /** Title of the `items` field. Defaults to `Items`. */
    listTitle?: string
    icon?: ComponentType
    /** Extra fields on each item, after `reference`. */
    fields?: FieldDefinition[]
    /** Preview of each item in the list. Defaults to the referenced document's `title`. */
    preview?: PreviewConfig
  }
}

/** The plugin's object type's value. */
export type HotspotImageValue<Fields = {[key: string]: unknown}> = {
  _type?: string
  image?: {_type?: string; asset?: {_ref: string}; [key: string]: unknown}
  items?: HotspotItem<Fields & {reference?: {_ref: string; _type?: string}}>[]
}

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
