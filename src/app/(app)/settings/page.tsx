import { listApiKeys } from '@/lib/api-keys'
import { listConnectedClients } from '@/lib/oauth'
import { requireUser } from '@/lib/session'
import { ConnectClaudeCard } from './connect-claude-card'
import { ExportCard } from './export-card'
import { ImportCard } from './import-card'

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="space-y-10 md:space-y-14">
      <h1 className="text-[32px] leading-tight tracking-[-0.01em]">Settings</h1>
      <section className="max-w-2xl space-y-3">
        <h2 className="text-2xl">Account</h2>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </section>
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
