import {Box, Button, Card, Stack, Text} from '@sanity/ui'
import {type ReactNode, useContext, useEffect, useMemo, useState} from 'react'
import {
  isReferenceSchemaType,
  type ObjectSchemaType,
  type Path,
  type ReferenceSchemaType,
  type RenderPreviewCallback,
  SanityDefaultPreview,
  type SchemaType,
  SearchResultItemPreview,
  useDocumentPreviewStore,
  usePerspective,
} from 'sanity'
import {PaneRouterContext, type PaneRouterContextValue} from 'sanity/structure'

import type {HotspotItem} from './types'

export interface ReferenceTarget {
  /** Name of the item's reference field. */
  fieldName?: string
  documentId?: string
  toType?: SchemaType
  /**
   * `loading` while the document's type is looked up, `missing` when the document doesn't exist
   * (or its type isn't one the field allows), else `resolved`.
   */
  status: 'loading' | 'resolved' | 'missing'
  /** The type found for the document, when it isn't one the field allows. */
  foundType?: string
}

/** The item's `reference` field (else its first reference field) and the document it points at. */
export function useReferenceTarget(
  value: HotspotItem,
  schemaType: ObjectSchemaType,
): ReferenceTarget {
  const field = useMemo(
    () =>
      schemaType.fields.find((f) => f.name === 'reference' && isReferenceSchemaType(f.type)) ??
      schemaType.fields.find((f) => isReferenceSchemaType(f.type)),
    [schemaType],
  )
  const refType = field?.type as ReferenceSchemaType | undefined
  const documentId = field ? (value[field.name] as {_ref?: string} | undefined)?._ref : undefined
  const singleType = refType?.to.length === 1 ? refType.to[0] : undefined

  // With several allowed types, look up which one the document is, in the current perspective
  // (drafts and release versions included), as the Studio's reference input does.
  const documentPreviewStore = useDocumentPreviewStore()
  const {perspectiveStack} = usePerspective()
  const [fetched, setFetched] = useState<{id: string; type: string | undefined} | null>(null)
  useEffect(() => {
    if (!documentId || singleType) return undefined
    const subscription = documentPreviewStore
      .observeDocumentTypeFromId(documentId, undefined, perspectiveStack)
      .subscribe((type) => setFetched({id: documentId, type}))
    return () => subscription.unsubscribe()
  }, [documentPreviewStore, documentId, singleType, perspectiveStack])
  const lookup = fetched && fetched.id === documentId ? fetched : null

  const toType = singleType ?? refType?.to.find((t) => t.name === lookup?.type)
  let status: ReferenceTarget['status'] = 'resolved'
  if (documentId && !toType) status = lookup ? 'missing' : 'loading'
  return {fieldName: field?.name, documentId, toType, status, foundType: lookup?.type}
}

/**
 * The Structure tool's pane router, or `null` outside it (a custom tool, a form rendered elsewhere).
 * Without a provider the context holds a placeholder whose links throw; it has no pane group.
 */
function usePaneRouterIfAvailable(): PaneRouterContextValue | null {
  const paneRouter = useContext(PaneRouterContext)
  return paneRouter.groupLength > 0 ? paneRouter : null
}

/** Outside the Structure tool there's no next pane to open the document in: a plain preview. */
function PlainReferenceLink(props: {children?: ReactNode}): ReactNode {
  return props.children
}

/** Whether the referenced document is open in the pane next to this one (as link-picker checks). */
export function useReferencePaneOpen(target: ReferenceTarget): boolean {
  const paneRouter = usePaneRouterIfAvailable()
  const {documentId, toType} = target
  if (!paneRouter || !documentId || !toType) return false
  const {routerPanesState, groupIndex} = paneRouter
  const nextPaneGroup = Array.isArray(routerPanesState) ? routerPanesState[groupIndex + 1] : null
  let siblings: unknown[] = []
  if (Array.isArray(nextPaneGroup)) siblings = nextPaneGroup
  else if (nextPaneGroup) siblings = [nextPaneGroup]
  return siblings.some((sibling) => {
    const pane = sibling as {
      id?: string
      params?: {id?: string; type?: string}
      payload?: {id?: string; type?: string}
    }
    const id = pane.id || pane.params?.id || pane.payload?.id
    const type = pane.params?.type || pane.payload?.type
    return id === documentId && (!type || type === toType.name)
  })
}

export interface SpotPreviewProps {
  value: HotspotItem
  itemPath: Path
  schemaType: ObjectSchemaType
  renderPreview: RenderPreviewCallback
  target: ReferenceTarget
  referencePaneOpen: boolean
}

/**
 * A spot's popover. Like the Studio's reference inputs, it previews the item's referenced document
 * (compact, with its draft/published status) and opens it in the next pane. Items without a
 * reference show their own preview.
 */
export function SpotPreview(props: SpotPreviewProps): ReactNode {
  const {value, itemPath, schemaType, renderPreview, target, referencePaneOpen} = props
  const perspective = usePerspective()
  const ReferenceChildLink = usePaneRouterIfAvailable()?.ReferenceChildLink ?? PlainReferenceLink
  const {fieldName, documentId, toType} = target

  let preview: ReactNode
  if (documentId && toType && fieldName) {
    preview = (
      <ReferenceChildLink
        documentId={documentId}
        documentType={toType.name}
        parentRefPath={[...itemPath, fieldName]}
      >
        <Button
          as="span"
          mode={referencePaneOpen ? 'default' : 'bleed'}
          tone={referencePaneOpen ? 'primary' : 'default'}
          padding={0}
          width="fill"
          style={{clipPath: 'inset(3px round 2px)'}}
        >
          <SearchResultItemPreview
            documentId={documentId}
            documentType={toType.name}
            layout="compact"
            perspective={perspective.perspectiveStack}
            schemaType={toType}
            showBadge={false}
          />
        </Button>
      </ReferenceChildLink>
    )
  } else if (documentId && target.status === 'missing') {
    preview = <MissingReference documentId={documentId} foundType={target.foundType} />
  } else if (documentId) {
    preview = <SanityDefaultPreview isPlaceholder layout="compact" />
  } else {
    preview = renderPreview({value, schemaType, layout: 'compact'})
  }

  return <Box style={{minWidth: 240}}>{preview}</Box>
}

/** A reference to a document that doesn't exist, worded like the Studio's reference input. */
function MissingReference(props: {documentId: string; foundType?: string}): ReactNode {
  const {documentId, foundType} = props
  return (
    <Card padding={3} radius={2} tone="critical" border>
      <Stack gap={3}>
        <Text size={1} weight="medium">
          {foundType ? 'Invalid reference type' : 'Not found'}
        </Text>
        <Text size={1} muted>
          {foundType ? (
            <>
              The referenced document is a <code>{foundType}</code>, which this field doesn&apos;t
              allow.
            </>
          ) : (
            <>
              The referenced document does not exist (ID: <code>{documentId}</code>).
            </>
          )}
        </Text>
      </Stack>
    </Card>
  )
}
