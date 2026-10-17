/**
 * Activity: the append-only audit log, newest first (`audit.read`). An intent without a result
 * shows as "outcome not recorded", never as "didn't happen" (auth-kit ADR 0010).
 */
import { ActivityLog } from 'auth-kit/admin/ui';
import type { Metadata } from 'next';
import { peopleActions } from '@/lib/admin';
import { pages } from '@/lib/auth';

export const metadata: Metadata = { title: 'Activity' };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  await pages.requireCan('audit.read', { live: true });
  const { cursor } = await searchParams;
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
  return (
    <div className="stack">
      <h1>Activity</h1>
      <ActivityLog page={page} {...('nextCursor' in page && page.nextCursor ? { nextHref: `/admin/activity?cursor=${encodeURIComponent(page.nextCursor)}` } : {})} />
    </div>
  );
}
