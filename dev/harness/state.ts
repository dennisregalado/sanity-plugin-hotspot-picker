/** Module-level stand-ins for the Studio's form context, set by the harness app. */
export const formCallbacks: {onPathOpen: (path: unknown[]) => void} = {onPathOpen: () => {}}
export const formValues = new Map<string, unknown>()
export const perspective = {perspectiveStack: []}
