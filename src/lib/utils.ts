export { cn } from 'cn'

export function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`
}
