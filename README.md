# sanity-plugin-hotspot-picker

A Sanity Studio array input that places each item as a draggable spot on an image field: shoppable images, annotated diagrams, store maps.

- **Click the image** to add a spot where you clicked.
- **Drag a spot** to move it. Its position is stored as `x`/`y` percentages of the image.
- **Click a spot** to edit its item. Hover to see the item's preview.
- **Spots with validation errors** show a warning icon and turn red.
- **Crop-aware**: the preview uses the image field's crop, so positions match a cropped image on your frontend.
- The Studio's own array list stays under the image, so reordering, removing and editing work as usual.

## Install

```sh
npm install sanity-plugin-hotspot-picker
```

**Requirements:** Sanity Studio 6. `@sanity/ui` (v4) and `@sanity/icons` (v5) are peer dependencies, and `sanity` already installs them, so there's nothing else to add.

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {hotspotPicker} from 'sanity-plugin-hotspot-picker'

export default defineConfig({
  // ...
  plugins: [hotspotPicker()],
})
```

## Usage

Add `options.hotspotPicker` to an array of objects, next to the image field the spots sit on. Each item needs `x` and `y` number fields; `hotspotFields()` returns them, hidden and read-only.

```ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {hotspotFields} from 'sanity-plugin-hotspot-picker'

export default defineType({
  name: 'shoppableImage',
  type: 'object',
  fields: [
    defineField({name: 'image', type: 'image', options: {hotspot: true}}),
    defineField({
      name: 'spots',
      type: 'array',
      options: {hotspotPicker: {imagePath: 'image'}},
      of: [
        defineArrayMember({
          name: 'spot',
          type: 'object',
          title: 'Product',
          fields: [
            ...hotspotFields(),
            defineField({
              name: 'product',
              type: 'reference',
              to: [{type: 'product'}],
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {select: {title: 'product.title', media: 'product.image'}},
        }),
      ],
    }),
  ],
})
```

### Options

Pass options to the plugin to set defaults for every field. A field's `options.hotspotPicker` overrides them (`hotspotPicker: true` uses the defaults).

| Option             | Default   |                                                                                            |
| ------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `imagePath`        | `'image'` | Field-level only. The image field, relative to the array's parent. Dots for nested fields. |
| `imageWidth`       | `1200`    | Width of the preview image requested from the Sanity CDN.                                  |
| `icon`             | Pin       | Icon component on each spot.                                                               |
| `tooltipPlacement` | automatic | `(item) => Placement`: where a spot's preview opens, e.g. from a field on the item.        |

Open the preview toward a placement stored on the item:

```ts
hotspotPicker({
  tooltipPlacement: (item) => {
    const placement = item.placement as {vertical?: string; horizontal?: string} | undefined
    if (placement?.vertical === 'top' && placement.horizontal === 'right') return 'top-start'
    return undefined
  },
})
```

### Without the plugin

Use the input on one field:

```ts
import {HotspotPicker} from 'sanity-plugin-hotspot-picker'

defineField({
  name: 'spots',
  type: 'array',
  options: {hotspotPicker: {imagePath: 'image'}},
  components: {input: HotspotPicker},
  of: [/* ... */],
})
```

## Stored value

```ts
spots: [{_key: 'a1b2c3d4e5f6', _type: 'spot', x: 42.5, y: 61.25, product: {_ref: '…'}}]
```

`x` and `y` are percentages (0–100, two decimals) from the image's top-left corner, measured on the cropped image.

## GROQ

```groq
*[_type == "page"][0]{
  image,
  spots[]{_key, x, y, "product": product->{title, slug}}
}
```

Position each spot with `left: ${x}%; top: ${y}%` over an image rendered with the same crop.

## License

MIT © Dennis Regalado
