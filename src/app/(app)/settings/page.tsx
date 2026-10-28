import Link from 'next/link'
import { listApiKeys } from '@/lib/api-keys'
import { getT } from '@/lib/i18n-server'
import { listConnectedClients } from '@/lib/oauth'
import { requireUser } from '@/lib/session'
import { ChangePasswordCard } from './change-password-card'
import { ConnectClaudeCard } from './connect-claude-card'
import { ExportCard } from './export-card'
import { ImportCard } from './import-card'

export default async function SettingsPage() {
  const user = await requireUser()
  const t = await getT()

  return (
    <div className="space-y-10 md:space-y-14">
      <h1 className="text-[32px] leading-tight tracking-[-0.01em]">{t.settings.title}</h1>
      <section className="max-w-2xl space-y-3">
        <h2 className="text-2xl">{t.settings.account}</h2>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </section>
      <ChangePasswordCard />
      <section className="max-w-2xl space-y-1">
        <h2 className="text-2xl">{t.settings.groups}</h2>
        <p className="text-muted-foreground">
          {t.settings.groupsNote}{' '}
          <Link href="/groups" className="text-primary underline underline-offset-4">
            {t.settings.groupsPage}
          </Link>
          .
        </p>
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
