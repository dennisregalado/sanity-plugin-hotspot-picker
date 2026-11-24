import type {ReactNode} from 'react'

function ReferenceChildLink(props: {children: ReactNode}): ReactNode {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} style={{color: 'inherit', textDecoration: 'none'}}>
      {props.children}
    </a>
  )
}

const router = {routerPanesState: [], groupIndex: 0, ReferenceChildLink}
export const usePaneRouter = () => router
