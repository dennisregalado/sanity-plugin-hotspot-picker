/**
 * Renders the plugin's object input (image + spots + a stand-in for the Studio's array list) with
 * mocked form props. Scenes: `?scene=busy|photo|empty|loading|tall`, plus `&numbered=1` and
 * `&readOnly=1`.
 */
import {AddIcon} from '@sanity/icons/Add'
import {
  Box,
  Button,
  Card,
  Flex,
  LayerProvider,
  PortalProvider,
  Stack,
  Text,
  ThemeProvider,
} from '@sanity/ui'
import '@sanity/ui/styles.css'

import {buildTheme} from '@sanity/ui/theme'
import {type ReactNode, StrictMode, useCallback, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'

import {HotspotObjectInput} from '../../src/HotspotObjectInput'
import {HotspotPickerInput} from '../../src/HotspotPickerInput'
import {applyPatches} from './patches'
import {previewTitle, renderFakePreview} from './shims/sanity'
import {formCallbacks} from './state'

const params = new URLSearchParams(window.location.search)
const scene = params.get('scene') ?? 'busy'

// Asset ids must be 24+ characters: pad the image's name with `z`s (the fake CDN strips them).
const assetRef = (name: string, size: string) => `image-${name.padEnd(24, 'z')}-${size}-jpg`
const IMAGES: Record<string, string> = {
  busy: assetRef('busy', '1600x1000'),
  photo: assetRef('photo', '1600x1067'),
  empty: assetRef('busy', '1600x1000'),
  loading: assetRef('slowbusy', '1600x1000'),
  tall: assetRef('tall', '800x2000'),
}

const ITEMS: Record<string, {_key: string; ref?: string; x: number; y: number}[]> = {
  busy: [
    {_key: 'a', ref: 'prod-1', x: 30, y: 72},
    {_key: 'b', x: 66, y: 55},
    {_key: 'c', ref: 'prod-3', x: 79, y: 80},
    {_key: 'd', ref: 'prod-2', x: 20, y: 30},
  ],
  photo: [
    {_key: 'a', ref: 'prod-1', x: 50, y: 62},
    {_key: 'b', ref: 'prod-2', x: 68, y: 60},
    {_key: 'c', x: 20, y: 75},
  ],
  empty: [],
  loading: [
    {_key: 'a', ref: 'prod-1', x: 30, y: 72},
    {_key: 'b', ref: 'prod-3', x: 79, y: 80},
  ],
  tall: [
    {_key: 'a', ref: 'prod-1', x: 40, y: 30},
    {_key: 'b', ref: 'prod-2', x: 60, y: 75},
  ],
}

const referenceType = {name: 'reference', jsonType: 'object', to: [{name: 'product', title: 'Product'}]}
const itemType = {
  name: 'spot',
  title: 'Product',
  jsonType: 'object',
  fields: [
    {name: 'reference', type: referenceType},
    {name: 'x', type: {name: 'number'}},
    {name: 'y', type: {name: 'number'}},
  ],
}
const itemsType = {name: 'array', jsonType: 'array', of: [itemType], options: {hotspotPicker: true}}
const objectType = {
  name: 'hotspotImage',
  jsonType: 'object',
  fields: [
    {name: 'image', type: {name: 'image'}},
    {name: 'items', type: itemsType},
  ],
}

type Item = {_key: string; _type: string; reference?: {_ref: string}; x?: number; y?: number}

function initialValue() {
  return {
    _type: 'hotspotImage',
    image: {_type: 'image', asset: {_ref: IMAGES[scene]}, alt: 'Chicago skyline at sunset'},
    items: ITEMS[scene].map(({ref, ...item}) => ({
      ...item,
      _type: 'spot',
      ...(ref ? {reference: {_ref: ref, _type: 'reference'}} : {}),
    })) as Item[],
  }
}

function FakeRow(props: {item: Item; open: boolean; invalid: boolean; onOpen: () => void}) {
  return (
    <Card
      as="button"
      type="button"
      radius={2}
      padding={1}
      tone={props.open ? 'primary' : props.invalid ? 'critical' : 'default'}
      border
      onClick={props.onOpen}
      style={{textAlign: 'left', width: '100%', cursor: 'pointer'}}
      data-row={props.item._key}
    >
      {renderFakePreview(props.item)}
    </Card>
  )
}

function App(): ReactNode {
  const [value, setValue] = useState(initialValue)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const readOnly = params.get('readOnly') === '1'
  const defaults = useMemo(() => ({numbered: params.get('numbered') === '1'}), [])

  formCallbacks.onPathOpen = (path) => {
    const last = path[path.length - 1] as {_key?: string} | undefined
    setOpenKey(last?._key ?? null)
  }

  const onChange = useCallback(
    (event: {patches: Parameters<typeof applyPatches>[1]}) =>
      setValue((current) => applyPatches(current, event.patches) as typeof current),
    [],
  )

  const items = value.items ?? []
  const members = items.map((item) => ({
    kind: 'item',
    key: item._key,
    open: item._key === openKey,
    item: {
      validation: item.reference ? [] : [{level: 'error', message: 'Required'}],
      focused: false,
      focusPath: [],
    },
  }))
  const objectMembers = [
    {kind: 'field', name: 'image', field: {}},
    {kind: 'field', name: 'items', field: {members}},
  ]

  const renderItems = (arrayProps: {
    renderItem: (itemProps: unknown) => ReactNode
    value?: Item[]
  }) => (
    <Stack gap={1}>
      {(arrayProps.value ?? []).map((item, index) => (
        <div key={item._key}>
          {arrayProps.renderItem({
            key: item._key,
            value: item,
            index,
            open: item._key === openKey,
            path: ['desktop', 'items', {_key: item._key}],
            onOpen: () => setOpenKey(item._key),
          })}
        </div>
      ))}
      <Button icon={AddIcon} text="Add item" mode="ghost" disabled={readOnly} />
    </Stack>
  )

  const arrayProps = {
    value: items,
    members,
    path: ['desktop', 'items'],
    schemaType: itemsType,
    readOnly,
    onChange,
    onItemOpen: formCallbacks.onPathOpen,
    renderPreview: ({value: v}: {value: Item}) => renderFakePreview(v),
    renderDefault: renderItems,
    renderItem: (itemProps: {value: Item; open: boolean; onOpen: () => void}) => (
      <FakeRow
        item={itemProps.value}
        open={itemProps.open}
        invalid={!itemProps.value.reference}
        onOpen={itemProps.onOpen}
      />
    ),
  }

  const objectProps = {
    path: ['desktop'],
    value,
    members: objectMembers,
    schemaType: objectType,
    readOnly,
    defaults,
    onChange,
    renderPreview: ({value: v}: {value: Item}) => renderFakePreview(v),
    // The native image input, shown while editing.
    renderInput: () => (
      <Card border radius={2} padding={3}>
        <Flex gap={3} align="center">
          <img
            src={`/images/demo/test/${scene === 'tall' ? 'tall' : 'busy'}-1x1.jpg?w=200`}
            alt=""
            style={{width: 120, height: 80, objectFit: 'cover', borderRadius: 3}}
          />
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Native image input (stand-in)
            </Text>
            <Text size={1} muted>
              Upload, crop and hotspot
            </Text>
          </Stack>
        </Flex>
      </Card>
    ),
    renderDefault: (props: {renderInput: (p: unknown) => ReactNode}) => (
      <Stack gap={5}>
        {props.renderInput({path: ['desktop', 'image']})}
        <Stack gap={3}>
          <Text size={1} weight="medium">
            Products
          </Text>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <HotspotPickerInput {...(arrayProps as any)} />
        </Stack>
      </Stack>
    ),
  }

  return (
    <Box padding={4} style={{maxWidth: 720, margin: '0 auto'}}>
      <Stack gap={3}>
        <Text size={1} weight="medium">
          Desktop
        </Text>
        <div style={{position: 'relative'}}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <HotspotObjectInput {...(objectProps as any)} />
        </div>
        <Text size={0} muted data-testid="state">
          {items.map((item, i) => `${i + 1}:${previewTitle(item)}@${item.x},${item.y}`).join(' | ')}
          {openKey ? ` · open ${openKey}` : ''}
        </Text>
      </Stack>
    </Box>
  )
}

const theme = buildTheme()
const app = (
  <ThemeProvider theme={theme}>
    <LayerProvider>
      <PortalProvider element={document.body}>
        <App />
      </PortalProvider>
    </LayerProvider>
  </ThemeProvider>
)
// `&strict=0` renders without StrictMode.
createRoot(document.getElementById('root')!).render(
  params.get('strict') === '0' ? app : <StrictMode>{app}</StrictMode>,
)
