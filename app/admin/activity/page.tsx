/**
 * Activity: append-only Audit Log (newest first, `audit.read`) + first-party Usage & Sign-ins.
 * Projects are named by their current names (never by their IDs).
 */
import type { ActivityItem, ActivityPage as Page } from 'auth-kit/admin';
import { ActivityLog } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { ActivityWorkspace } from '@/components/admin/activity-workspace';
import { peopleActions } from '@/lib/admin';
import { usageLedgerStore } from '@/lib/admin-stores';
import { pages } from '@/lib/auth';
import { projectStore } from '@/lib/projects';

async function projectNames(page: Page): Promise<Record<string, ActivityItem>> {
  if (page.state !== 'ok') return {};
  const ids = [...new Set(page.entries.map((e) => e.event.target?.recordId).filter((r): r is string => r?.startsWith('project:') === true))].map((r) => r.slice('project:'.length));
  if (ids.length === 0) return {};
  try {
    const projects = await projectStore().getMany(ids);
    return Object.fromEntries(projects.map((p) => [`project:${p.id}`, { noun: 'project', name: p.name }]));
  } catch {
    return {};
  }
}

export const metadata: Metadata = { title: 'Activity' };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  await pages.requireCan('audit.read', { live: true });
  const { cursor } = await searchParams;
  const usage = await usageLedgerStore().get().catch(() => ({ accounts: {}, dailyCounts: {} }));
  let page;
  try {
    page = await peopleActions().listActivity(typeof cursor === 'string' && cursor ? { cursor } : {});
  } catch (error) {
    return (
      <div className="stack">
        <h1>Activity</h1>
        <p className="notice notice-error" role="alert">
          — Couldn&apos;t load the activity log: {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }
  const items = await projectNames(page);
  const auditNode = (
    <ActivityLog
      page={page}
      items={items}
      {...('nextCursor' in page && page.nextCursor ? { nextHref: `/admin/activity?cursor=${encodeURIComponent(page.nextCursor)}` } : {})}
    />
  );
  return <ActivityWorkspace auditNode={auditNode} usage={usage} />;
}
