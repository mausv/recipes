import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listApiKeys } from '@/lib/api-keys'
import { listConnectedClients } from '@/lib/oauth'
import { requireUser } from '@/lib/session'
import { ConnectClaudeCard } from './connect-claude-card'
import { ExportCard } from './export-card'
import { ImportCard } from './import-card'

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </CardContent>
      </Card>
      <ConnectClaudeCard
        keys={listApiKeys(user.id)}
        connections={listConnectedClients(user.id)}
        endpoint={new URL('/api/mcp', process.env.BETTER_AUTH_URL).href}
      />
      <ExportCard />
      <ImportCard />
    </div>
  )
}
