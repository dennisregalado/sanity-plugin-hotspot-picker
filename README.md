# sanity-plugin-hotspot-picker

A Sanity Studio field for shoppable images, annotated diagrams and store maps: an image with draggable spots on it, each spot an item that can reference a document.

- **Click the image** to add a spot where you clicked.
- **Drag a spot** to move it. Its position is stored as `x`/`y` percentages of the image.
- **Click a spot** to edit its item.
- **Hover a spot** to preview its referenced document (with its draft/published status). Click the preview to open the document in the next pane; the spot stays highlighted while it's open.
- **Edit image**: the pencil button swaps the spots for the native image input (upload, crop, hotspot). With no image set, the native input always shows.
- **Spots with validation errors** show a warning icon and turn red.
- **Crop-aware**: spots are placed on the cropped image, so positions match a cropped image on your frontend. Changing the crop later moves every spot with it (see [Cropping](#cropping)).
- The Studio's own array list stays under the image, so adding, reordering, removing and editing work as usual.

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
  plugins: [
    hotspotPicker({
      reference: {title: 'Product', to: [{type: 'product'}]},
    }),
  ],
})
```

## Usage

The plugin registers a `hotspotImage` object type. Use it like any other type:

```ts
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'shoppableImage',
  type: 'object',
  fields: [
    defineField({name: 'title', type: 'string'}),
    defineField({name: 'desktop', title: 'Desktop', type: 'hotspotImage'}),
    defineField({name: 'mobile', title: 'Mobile', type: 'hotspotImage'}),
  ],
})
```

Each `hotspotImage` has two fields:

- `image`: a native image field (crop and hotspot on). It renders without its own label, under the `hotspotImage` field's title.
- `items`: the spots. Each item has a `reference` (if configured), any extra `fields` you add, and its hidden `x`/`y` position.

## Options

Everything about the type is configured on the plugin:

```ts
import {PinIcon} from '@sanity/icons'
import {defineField} from 'sanity'
import {hotspotPicker} from 'sanity-plugin-hotspot-picker'

hotspotPicker({
  // The object type
  name: 'hotspotImage', // type name
  title: 'Hotspot image',

  // The `image` field: anything an image field takes. Passing `options` replaces the default
  // `{hotspot: true}`, so include it.
  image: {
    fields: [defineField({name: 'alt', type: 'string', title: 'Alternative text'})],
  },

  // Each item's `reference` field: anything a reference field takes. Required by default.
  reference: {
    title: 'Product',
    to: [{type: 'product'}],
    options: {filter: 'store.status == "active"'},
  },

  // The items
  item: {
    name: 'spot', // item type name
    title: 'Product', // defaults to the reference's title
    listTitle: 'Products', // title of the `items` field
    icon: PinIcon,
    fields: [defineField({name: 'label', type: 'string'})], // after `reference`
    preview: {select: {title: 'reference.title', media: 'reference.image'}},
  },

  // The spots
  icon: PinIcon, // icon on each spot
  imageWidth: 1200, // width of the preview image requested from the Sanity CDN
  tooltipPlacement: (item) => undefined, // where a spot's popover opens; see below
})
```

| Option             | Default                        |                                                                                                    |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `name`             | `'hotspotImage'`               | Name of the object type.                                                                           |
| `title`            | `'Hotspot image'`              | Title of the object type.                                                                          |
| `image`            | `{options: {hotspot: true}}`   | Overrides for the `image` field (`fields`, `options`, `title`...). `options` replaces the default. |
| `reference`        | none                           | The item's `reference` field (`to` is required). Required unless you pass your own `validation`.   |
| `item.name`        | `'spot'`                       | Type name of each item.                                                                            |
| `item.title`       | reference title, else `'Spot'` | Title of each item.                                                                                |
| `item.listTitle`   | `'Items'`                      | Title of the `items` field.                                                                        |
| `item.icon`        | none                           | Icon of each item.                                                                                 |
| `item.fields`      | none                           | Extra fields on each item, after `reference`.                                                      |
| `item.preview`     | the reference's `title`        | Preview of each item in the list.                                                                  |
| `icon`             | Pin                            | Icon component on each spot.                                                                       |
| `imageWidth`       | `1200`                         | Width of the preview image requested from the Sanity CDN.                                          |
| `tooltipPlacement` | automatic                      | `(item) => Placement`: where a spot's popover opens, e.g. from a field on the item.                |

Open the popover toward a placement stored on the item:

```ts
hotspotPicker({
  item: {fields: [defineField({name: 'placement', type: 'string'})]},
  tooltipPlacement: (item) => (item.placement === 'left' ? 'left' : undefined),
})
```

## Stored value

```ts
desktop: {
  _type: 'hotspotImage',
  image: {_type: 'image', asset: {_ref: 'image-…'}, crop: {…}, hotspot: {…}},
  items: [
    {_key: 'a1b2c3d4e5f6', _type: 'spot', reference: {_ref: '…', _type: 'reference'}, x: 42.5, y: 61.25},
  ],
}
```

`x` and `y` are percentages (0–100, two decimals) from the image's top-left corner, measured on the cropped image.

### Cropping

Because positions are relative to the crop, changing the crop moves every spot: a spot at `x: 50` stays in the middle of whatever the new crop shows, not on the same part of the photo. Re-check spots after re-cropping an image that already has them. In edit mode, the input shows a note about this when the image has spots.

## GROQ

The query mirrors the schema:

```groq
*[_type == "page"][0]{
  desktop{
    image,
    items[]{_key, x, y, "product": reference->{title, slug}}
  }
}
```

Render the image with its crop, then position each spot over it with `left: ${x}%; top: ${y}%`.

## On your own array field

Without the object type, any array of objects can be a spot picker over a sibling image field. Add `options.hotspotPicker`, and give each item `x`/`y` fields with `hotspotFields()`:

```ts
import {defineArrayMember, defineField} from 'sanity'
import {hotspotFields} from 'sanity-plugin-hotspot-picker'

// in an object or document type
fields: [
  defineField({name: 'image', type: 'image', options: {hotspot: true}}),
  defineField({
    name: 'spots',
    type: 'array',
    options: {hotspotPicker: {imagePath: 'image'}}, // relative to the array's parent; dots for nesting
    of: [
      defineArrayMember({
        name: 'spot',
        type: 'object',
        fields: [
          ...hotspotFields(),
          defineField({name: 'product', type: 'reference', to: [{type: 'product'}]}),
        ],
      }),
    ],
  }),
]
```

The plugin's `icon`, `imageWidth` and `tooltipPlacement` apply here too; a field's `options.hotspotPicker` overrides them (`hotspotPicker: true` uses the plugin's). Without the plugin, set the input yourself with `components: {input: HotspotPicker}`.

## Releasing

Publishing runs from GitHub Actions; nobody runs `npm publish` locally.

1. Bump `version` in `package.json` in your PR (`1.2.0-beta.1` style versions publish under `next`).
2. Merge to `main`. The Publish workflow publishes that version to npm with provenance, then tags it and creates the GitHub release `v<version>`. A merge without a version bump publishes nothing.

CI runs lint, typecheck and the build on every PR and push to `main`, and `prepublishOnly` runs them again before publishing.

## License

MIT © Dennis Regalado
