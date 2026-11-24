import {Box, Flex, Stack} from '@sanity/ui'
import type {ReactNode} from 'react'
import {
  ChangeIndicator,
  FieldPresence,
  FormFieldValidationStatus,
  type ObjectFieldProps,
  TextWithTone,
} from 'sanity'

/**
 * The `image` field without its label: the object field's own title stands for it, like the search
 * listing. Its validation, presence and changes still show, since nothing else would show them.
 */
export function ImageField(props: ObjectFieldProps): ReactNode {
  const {validation, presence, changed, path, inputProps, children} = props
  const hasStatus = validation.length > 0 || presence.length > 0
  const tone = validation.some((v) => v.level === 'error') ? 'critical' : 'caution'

  return (
    <Stack gap={2}>
      {hasStatus && (
        <Flex align="center" gap={2}>
          {validation.length > 0 && (
            <>
              <FormFieldValidationStatus validation={validation} fontSize={1} placement="top" />
              <TextWithTone size={1} tone={tone}>
                {validation.map((v) => v.message).join(' ')}
              </TextWithTone>
            </>
          )}
          <Box flex={1} />
          {presence.length > 0 && <FieldPresence presence={presence} maxAvatars={4} />}
        </Flex>
      )}
      <ChangeIndicator path={path} isChanged={changed} hasFocus={Boolean(inputProps.focused)}>
        {children}
      </ChangeIndicator>
    </Stack>
  )
}
