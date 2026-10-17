import Link from 'next/link'
import { getActiveGroup } from '@/lib/active-group'
import { listGroups } from '@/lib/groups'
import { requireUser } from '@/lib/session'
import { NewGroupForm } from './new-group-form'
import { SwitchButton } from './switch-button'

export default async function GroupsPage() {
  const user = await requireUser()
  const active = await getActiveGroup(user.id)
  const groups = listGroups(user.id)

  return (
    <div className="max-w-2xl space-y-10 md:space-y-14">
      <div className="space-y-2">
        <h1 className="text-[32px] leading-tight tracking-[-0.01em]">Groups</h1>
        <p className="text-muted-foreground">
          Each group has its own shopping list, pantry and meal plan. Recipes you share into a group
          are visible to its members.
        </p>
      </div>

      <ul className="divide-y border-y">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/groups/${g.id}`}
                  className="font-heading text-[22px] leading-tight decoration-1 underline-offset-4 hover:underline"
                >
                  {g.name}
                </Link>
                {g.id === active.id && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[13px] leading-none text-secondary-foreground">
                    Active
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {g.role === 'admin' ? 'Admin' : 'Member'}, {g.memberCount}{' '}
                {g.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
            {g.id !== active.id && <SwitchButton groupId={g.id} name={g.name} />}
          </li>
        ))}
      </ul>

      <NewGroupForm />
    </div>
  )
}
