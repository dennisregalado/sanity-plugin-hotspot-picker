/**
 * Just enough of `sanity` for the plugin's inputs to render outside a Studio. Patches are plain
 * objects that `applyPatches` (in ../patches.ts) applies to the harness's state.
 */
import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'

import {formCallbacks, formValues, perspective} from '../state'

type Path = (string | number | {_key: string})[]
export type Patch = {type: string; path: Path; value?: unknown; items?: unknown[]; position?: string}

export const set = (value: unknown, path: Path = []): Patch => ({type: 'set', path, value})
export const setIfMissing = (value: unknown, path: Path = []): Patch => ({
  type: 'setIfMissing',
  path,
  value,
})
export const unset = (path: Path = []): Patch => ({type: 'unset', path})
export const insert = (items: unknown[], position: string, path: Path = []): Patch => ({
  type: 'insert',
  path,
  items,
  position,
})

export class PatchEvent {
  constructor(public patches: Patch[]) {}
  static from(patches: Patch[] | Patch): PatchEvent {
    return new PatchEvent(Array.isArray(patches) ? patches : [patches])
  }
  prefixAll(segment: string | {_key: string}): PatchEvent {
    return new PatchEvent(this.patches.map((p) => ({...p, path: [segment, ...p.path]})))
  }
}

export function useClient() {
  return {
    config: () => ({apiHost: window.location.origin, projectId: 'demo', dataset: 'test'}),
    observable: {fetch: () => ({subscribe: () => ({unsubscribe() {}})})},
  }
}
export const useFormCallbacks = () => formCallbacks
export const useFormValue = (path: Path) => formValues.get(JSON.stringify(path))
export const usePerspective = () => perspective

export const isReferenceSchemaType = (type: {jsonType?: string; to?: unknown}) =>
  Boolean(type && type.to)
export const isArrayOfObjectsSchemaType = () => true
const identity = <T,>(value: T) => value
export const definePlugin = identity
export const defineType = identity
export const defineField = identity
export const defineArrayMember = identity

const DOCUMENTS: Record<string, {title: string; subtitle: string; color: string}> = {
  'prod-1': {title: 'Waterproof jacket', subtitle: '$189 · In stock', color: '#e8590c'},
  'prod-2': {title: 'Trail backpack 30L', subtitle: '$129 · Low stock', color: '#2f9e44'},
  'prod-3': {title: 'Merino beanie', subtitle: '$35 · In stock', color: '#1971c2'},
}

function FakePreview(props: {title: string; subtitle?: string; color?: string}): ReactNode {
  return (
    <Flex align="center" gap={2} padding={2}>
      <Box
        style={{
          width: 33,
          height: 33,
          borderRadius: 3,
          flex: 'none',
          background: props.color ?? '#ccc',
        }}
      />
      <Stack gap={2} flex={1}>
        <Text size={1} weight="medium" textOverflow="ellipsis">
          {props.title}
        </Text>
        {props.subtitle && (
          <Text size={1} muted textOverflow="ellipsis">
            {props.subtitle}
          </Text>
        )}
      </Stack>
    </Flex>
  )
}

export function SearchResultItemPreview(props: {documentId: string}): ReactNode {
  const doc = DOCUMENTS[props.documentId] ?? {title: props.documentId, subtitle: '', color: '#ccc'}
  return <FakePreview {...doc} />
}

export function SanityDefaultPreview(): ReactNode {
  return <FakePreview title="Loading…" />
}

export function previewTitle(value: {reference?: {_ref?: string}}): string {
  const ref = value.reference?._ref
  return ref ? (DOCUMENTS[ref]?.title ?? ref) : 'Untitled'
}

export function renderFakePreview(value: {reference?: {_ref?: string}}): ReactNode {
  const ref = value.reference?._ref
  const doc = ref ? DOCUMENTS[ref] : undefined
  return <FakePreview title={doc?.title ?? 'Untitled'} subtitle={doc?.subtitle} color={doc?.color} />
}

export {Card}
