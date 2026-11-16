import {Box, Button} from '@sanity/ui'
import {type ReactNode, useEffect, useMemo, useState} from 'react'
import {
  isReferenceSchemaType,
  type ObjectSchemaType,
  type Path,
  type ReferenceSchemaType,
  type RenderPreviewCallback,
  SanityDefaultPreview,
  type SchemaType,
  SearchResultItemPreview,
  useClient,
  usePerspective,
} from 'sanity'
import {usePaneRouter} from 'sanity/structure'

import type {HotspotItem} from './types'

export interface ReferenceTarget {
  /** Name of the item's reference field. */
  fieldName?: string
  documentId?: string
  toType?: SchemaType
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

  // With several allowed types, look up which one the document is.
  const client = useClient({apiVersion: '2025-01-01'})
  const [fetched, setFetched] = useState<{id: string; type: string | null} | null>(null)
  useEffect(() => {
    if (!documentId || singleType) return undefined
    const subscription = client.observable
      .fetch<string | null>(`*[_id in [$id, "drafts." + $id]][0]._type`, {id: documentId})
      .subscribe((type) => setFetched({id: documentId, type}))
    return () => subscription.unsubscribe()
  }, [client, documentId, singleType])
  const fetchedType = fetched && fetched.id === documentId ? fetched.type : null

  const toType = singleType ?? refType?.to.find((t) => t.name === fetchedType)
  return {fieldName: field?.name, documentId, toType}
}

/** Whether the referenced document is open in the pane next to this one (as link-picker checks). */
export function useReferencePaneOpen(target: ReferenceTarget): boolean {
  const {routerPanesState, groupIndex} = usePaneRouter()
  const {documentId, toType} = target
  if (!documentId || !toType) return false
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
  const {ReferenceChildLink} = usePaneRouter()
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
  } else if (documentId) {
    preview = <SanityDefaultPreview isPlaceholder layout="compact" />
  } else {
    preview = renderPreview({value, schemaType, layout: 'compact'})
  }

  return <Box style={{minWidth: 240}}>{preview}</Box>
}
