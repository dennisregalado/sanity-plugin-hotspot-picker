/* Scenes for checking the plugin's inputs in a browser. Each scene is one `[data-scene]` block. */
import {CopyIcon} from '@sanity/icons/Copy'
import {Box, Button, Card, Flex, Heading, Stack, studioTheme, Text, ThemeProvider} from '@sanity/ui'
import {LayerProvider} from '@sanity/ui'
import {ToastProvider} from '@sanity/ui/toast'
import {Component, type ReactNode, StrictMode, useEffect, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {
  createSchema,
  defineField,
  defineType,
  type FormPatch,
  FormFieldSet,
  type ObjectSchemaType,
  type ArraySchemaType,
  WorkspaceProvider,
  FieldActionsProvider,
} from 'sanity'
import {PaneRouterContext} from 'sanity/structure'

import {HotspotFrame} from '../src/HotspotFrame'
import {HotspotObjectInput} from '../src/HotspotObjectInput'
import {createHotspotType} from '../src/schema'
import {documentTypes} from './mock-sanity'

const params = new URLSearchParams(window.location.search)
const only = params.get('scene')

/* ---------- schema ---------- */

const hotspotType = createHotspotType({
  reference: {title: 'Product', to: [{type: 'product'}, {type: 'collection'}]},
  item: {fields: [defineField({name: 'label', type: 'string', initialValue: 'New spot'})]},
})
const schema = createSchema({
  name: 'harness',
  types: [
    defineType({name: 'product', type: 'document', fields: [{name: 'title', type: 'string'}]}),
    defineType({name: 'collection', type: 'document', fields: [{name: 'title', type: 'string'}]}),
    hotspotType,
  ],
})
const objectType = schema.get('hotspotImage') as ObjectSchemaType
const itemsType = objectType.fields.find((f) => f.name === 'items')!.type as ArraySchemaType
const itemType = itemsType.of[0] as ObjectSchemaType
const imageField = (hotspotType as unknown as {fields: {components?: {field?: unknown}}[]})
  .fields[0]
const ImageField = imageField.components!.field as (props: Record<string, unknown>) => ReactNode

const image = {
  _type: 'image',
  asset: {_type: 'reference', _ref: 'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-1200x800-jpg'},
}

documentTypes.next({
  'product-1': 'product',
  'deleted-doc': undefined,
})

/* ---------- helpers ---------- */

class Boundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null}
  static getDerivedStateFromError(error: Error) {
    return {error}
  }
  render() {
    if (this.state.error)
      return (
        <Card padding={3} tone="critical" border radius={2} data-testid="crash">
          <Text size={1} weight="medium">
            Crashed: {this.state.error.message}
          </Text>
        </Card>
      )
    return this.props.children
  }
}

const paneRouter = {
  index: 1,
  groupIndex: 0,
  siblingIndex: 0,
  payload: undefined,
  params: {},
  hasGroupSiblings: false,
  groupLength: 1,
  routerPanesState: [[{id: 'page-1'}]],
  ReferenceChildLink: (props: {children: ReactNode}) => <a href="#ref">{props.children}</a>,
}

function WithPaneRouter(props: {children: ReactNode}) {
  return (
    <PaneRouterContext.Provider value={paneRouter as never}>
      {props.children}
    </PaneRouterContext.Provider>
  )
}

const renderPreview = ({value}: {value: unknown}) => (
  <Box padding={2}>
    <Text size={1}>{(value as {label?: string}).label ?? 'Spot'}</Text>
  </Box>
)

function Scene(props: {
  id: string
  title: string
  note?: string
  children: ReactNode
  width?: number
}) {
  if (only && only !== props.id) return null
  return (
    <Card
      padding={4}
      radius={3}
      shadow={1}
      data-scene={props.id}
      style={{width: props.width ?? 520, position: 'relative'}}
    >
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading size={1}>{props.title}</Heading>
          {props.note && (
            <Text size={1} muted>
              {props.note}
            </Text>
          )}
        </Stack>
        {props.children}
      </Stack>
    </Card>
  )
}

function useOpenLog() {
  const [opened, setOpened] = useState<string>('none')
  return {opened, onOpen: (key: string) => setOpened(key)}
}

function FrameScene(props: {
  items: Record<string, unknown>[]
  readOnly?: boolean
  showPatches?: boolean
  showOpened?: boolean
}) {
  const [items, setItems] = useState(props.items)
  const [patches, setPatches] = useState<FormPatch[] | null>(null)
  const {opened, onOpen} = useOpenLog()
  return (
    <Stack gap={3}>
      <HotspotFrame
        image={image}
        items={items as never}
        arrayPath={['desktop', 'items']}
        itemType={itemType}
        invalidKeys={new Set()}
        readOnly={props.readOnly}
        options={{}}
        renderPreview={renderPreview as never}
        onPatch={(next) => {
          setPatches(next)
          const inserted = next.find((p) => p.type === 'insert') as {items?: unknown[]} | undefined
          if (inserted?.items) setItems((current) => [...current, ...(inserted.items as never[])])
        }}
        onOpen={onOpen}
      />
      {props.showOpened && (
        <Text size={1} data-testid="opened">
          Opened item: <code>{opened}</code>
        </Text>
      )}
      {props.showPatches && (
        <Card padding={3} tone="transparent" radius={2} border>
          <Text size={1} data-testid="patches">
            <code style={{whiteSpace: 'pre-wrap'}}>
              {patches
                ? JSON.stringify(
                    patches.find((p) => p.type === 'insert'),
                    null,
                    1,
                  )
                : 'Click the image to add a spot'}
            </code>
          </Text>
        </Card>
      )}
    </Stack>
  )
}

/* ---------- object input (bugs 7, 8) ---------- */

function FakeNativeImageInput() {
  return (
    <Card border radius={2} overflow="hidden">
      <img src="/demo.jpg" alt="" style={{display: 'block', width: '100%'}} />
    </Card>
  )
}

const OBJECT_VALIDATION = [
  {level: 'warning' as const, message: 'Add at least 3 products', path: ['desktop']},
]
const HEADER_ACTIONS = [
  {type: 'action' as const, title: 'Copy field', icon: CopyIcon, onAction: () => undefined},
]

function ObjectScene(props: {items: Record<string, unknown>[]; focused?: boolean}) {
  const value = useMemo(() => ({_type: 'hotspotImage', image, items: props.items}), [props.items])
  const path = useMemo(() => ['desktop'], [])
  const inputProps = {
    value,
    path,
    schemaType: objectType,
    readOnly: false,
    members: [
      {kind: 'field', name: 'image', key: 'image'},
      {kind: 'field', name: 'items', key: 'items', field: {members: []}},
    ],
    onChange: () => undefined,
    renderPreview,
    renderInput: (inputProps: {path: unknown[]}) =>
      inputProps.path[1] === 'image' ? <FakeNativeImageInput /> : null,
    renderDefault: (p: {renderInput: (x: unknown) => ReactNode}) => (
      <Stack gap={5}>
        <ImageField
          validation={[]}
          presence={[]}
          changed={false}
          path={['desktop', 'image']}
          inputProps={{focused: false}}
        >
          {p.renderInput({path: ['desktop', 'image'], schemaType: objectType.fields[0].type})}
        </ImageField>
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Items
          </Text>
          <Card border radius={2} padding={3}>
            <Text size={1} muted>
              {props.items.length} items (the Studio&apos;s array input)
            </Text>
          </Card>
        </Stack>
      </Stack>
    ),
  }
  return (
    <FieldActionsProvider actions={HEADER_ACTIONS} path={path} focused={props.focused}>
      <FormFieldSet
        title="Desktop"
        level={1}
        inputId="desktop"
        path={['desktop']}
        validation={OBJECT_VALIDATION}
        __unstable_headerActions={HEADER_ACTIONS}
      >
        <HotspotObjectInput {...(inputProps as never)} />
      </FormFieldSet>
    </FieldActionsProvider>
  )
}

/* ---------- image field (bug 4) ---------- */

function ImageFieldScene() {
  return (
    <FormFieldSet title="Desktop" level={1} inputId="desktop-4" path={['desktop']}>
      <ImageField
        validation={[{level: 'error', message: 'Required', path: ['desktop', 'image']}]}
        presence={[]}
        changed
        path={['desktop', 'image']}
        inputProps={{focused: false}}
      >
        <Card border radius={2} padding={4} tone="transparent">
          <Flex justify="center" gap={2}>
            <Button mode="ghost" text="Upload" />
            <Button mode="ghost" text="Select" />
          </Flex>
        </Card>
      </ImageField>
    </FormFieldSet>
  )
}

/* ---------- page ---------- */

const spotWithRef = (key: string, id: string, x: number, y: number) => ({
  _key: key,
  _type: 'spot',
  x,
  y,
  reference: {_type: 'reference', _ref: id},
})

function App() {
  const [opened, setOpened] = useState('')
  useEffect(() => {
    const handler = (event: Event) => setOpened(JSON.stringify((event as CustomEvent).detail))
    window.addEventListener('harness:open', handler)
    return () => window.removeEventListener('harness:open', handler)
  }, [])
  return (
    <Flex wrap="wrap" gap={4} padding={4} style={{alignItems: 'flex-start'}}>
      <Scene id="readonly" title="1. Read-only: click a spot" note="The spot should open its item.">
        <WithPaneRouter>
          <FrameScene
            readOnly
            showOpened
            items={[{_key: 'spot-a', _type: 'spot', x: 40, y: 55, label: 'Sofa'}]}
          />
        </WithPaneRouter>
      </Scene>

      <Scene
        id="initial"
        title="2. New spot: initial values"
        note="`label` has initialValue “New spot”."
      >
        <WithPaneRouter>
          <FrameScene showPatches items={[]} />
        </WithPaneRouter>
      </Scene>

      <Scene id="missing" title="3. Reference to a deleted document" note="Hover the spot.">
        <WithPaneRouter>
          <FrameScene items={[spotWithRef('spot-m', 'deleted-doc', 45, 60)]} />
        </WithPaneRouter>
      </Scene>

      <Scene
        id="imagefield"
        title="4. Required image, empty"
        note="The image field has a `required` error and a change."
      >
        <ImageFieldScene />
      </Scene>

      <Scene
        id="norouter"
        title="5. Outside the Structure tool (no pane router)"
        note="Hover the spot."
      >
        <Boundary>
          <FrameScene items={[spotWithRef('spot-r', 'product-1', 50, 45)]} />
        </Boundary>
      </Scene>

      <Scene
        id="edges"
        title="6. Spots at the edges"
        note="Spots at (0, 0), (100, 0), (0, 100), (100, 100) and (100, 50)."
      >
        <WithPaneRouter>
          <FrameScene
            items={[
              {_key: 'e1', _type: 'spot', x: 0, y: 0},
              {_key: 'e2', _type: 'spot', x: 100, y: 0},
              {_key: 'e3', _type: 'spot', x: 0, y: 100},
              {_key: 'e4', _type: 'spot', x: 100, y: 100},
              {_key: 'e5', _type: 'spot', x: 100, y: 50},
            ]}
          />
        </WithPaneRouter>
      </Scene>

      <Scene
        id="editbutton"
        title="7. Edit image button"
        note="Field focused, so its actions show."
        width={560}
      >
        <WithPaneRouter>
          <ObjectScene
            items={[spotWithRef('s1', 'product-1', 30, 60), spotWithRef('s2', 'product-1', 70, 40)]}
          />
        </WithPaneRouter>
      </Scene>

      <Scene
        id="crop"
        title="8. Edit mode with spots"
        note="After clicking Edit image."
        width={560}
      >
        <WithPaneRouter>
          <ObjectScene
            items={[spotWithRef('s1', 'product-1', 30, 60), spotWithRef('s2', 'product-1', 70, 40)]}
          />
        </WithPaneRouter>
      </Scene>

      {opened && (
        <Text size={1} data-testid="form-opened">
          onPathOpen: <code>{opened}</code>
        </Text>
      )}
    </Flex>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={studioTheme}>
      <WorkspaceProvider workspace={{beta: {}, __internal: {}} as never}>
        <ToastProvider>
          <LayerProvider>
            <Card tone="transparent" style={{minHeight: '100vh'}}>
              <App />
            </Card>
          </LayerProvider>
        </ToastProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  </StrictMode>,
)
