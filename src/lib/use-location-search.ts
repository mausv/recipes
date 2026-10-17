import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function useLocationSearch() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ''
  )
}
