/**
 * Admin home: opens directly into the People & Role Matrix workspace (`people.read`, checked live).
 */
import type { Metadata } from 'next';
import { pages } from '@/lib/auth';
import PeoplePage from './people/page';

export const metadata: Metadata = { title: 'Admin · People' };

export default async function AdminHome() {
  await pages.requireCan('people.read', { live: true });
  return <PeoplePage />;
}
