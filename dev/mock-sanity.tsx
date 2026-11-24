/* The real `sanity` exports, with the Studio-bound hooks replaced by fakes the scenes control. */
import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {type ReactNode} from 'react'
import {BehaviorSubject, filter, map, of} from 'rxjs'

// eslint-disable-next-line import/no-unresolved
export * from '../node_modules/sanity/lib/index.js'
// eslint-disable-next-line import/no-unresolved
import {CompactPreview, resolveInitialValueForType} from '../node_modules/sanity/lib/index.js'

/** `_type` lookups by document id: a string, `undefined` (missing) or `'pending'` (never resolves). */
export const documentTypes = new BehaviorSubject<Record<string, string | undefined | 'pending'>>({})
export const openedPaths: string[] = []

const config = {projectId: 'demo', dataset: 'production', apiHost: 'https://api.sanity.io'}

const client = {
  config: () => config,
  observable: {
    // main's one-off GROQ lookup: `null` when the document is missing.
    fetch: (_query: string, params: {id: string}) => {
      const type = documentTypes.value[params.id]
      return of(type === 'pending' ? null : (type ?? null))
    },
  },
}

// Stable, like the Studio's own hooks.
export function useClient() {
  return client
}

const perspective = {perspectiveStack: ['drafts'], selectedPerspectiveName: undefined}
export function usePerspective() {
  return perspective
}

const previewStore = {
  // 'pending' never emits, like a slow network.
  observeDocumentTypeFromId: (id: string) =>
    documentTypes.pipe(
      filter((types) => types[id] !== 'pending'),
      map((types) => types[id] as string | undefined),
    ),
}
export function useDocumentPreviewStore() {
  return previewStore
}

const formCallbacks = {
  onPathOpen: (path: unknown) => {
    openedPaths.push(JSON.stringify(path))
    window.dispatchEvent(new CustomEvent('harness:open', {detail: path}))
  },
}
export function useFormCallbacks() {
  return formCallbacks
}

export function SearchResultItemPreview(props: {
  documentId: string
  documentType: string
}): ReactNode {
  return (
    <Card padding={2} radius={2}>
      <Flex gap={3} align="center">
        <Box style={{width: 33, height: 33, borderRadius: 3, background: '#7a5c3e'}} />
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Walnut side table
          </Text>
          <Text size={1} muted>
            {props.documentType} · {props.documentId}
          </Text>
        </Stack>
      </Flex>
    </Card>
  )
}

// The real one reads the Studio's source context; its compact layout is `CompactPreview`.
export function SanityDefaultPreview(props: {
  isPlaceholder?: boolean
  title?: ReactNode
}): ReactNode {
  return <CompactPreview {...props} />
}

// The real hook reads its context from the Studio's source; static initial values don't need it.
const initialValueContext = {projectId: 'demo', dataset: 'production', currentUser: null} as never
export function useResolveInitialValueForType() {
  return (type: never, params: never) =>
    resolveInitialValueForType(type, params, 10, initialValueContext)
}
