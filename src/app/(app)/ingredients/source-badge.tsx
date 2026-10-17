import { Badge } from '@/components/ui/badge'

const labels = { manual: 'Manual', off: 'Open Food Facts', usda: 'USDA' } as const

export function SourceBadge({ source }: { source: keyof typeof labels }) {
  return <Badge variant={source === 'manual' ? 'outline' : 'secondary'}>{labels[source]}</Badge>
}
