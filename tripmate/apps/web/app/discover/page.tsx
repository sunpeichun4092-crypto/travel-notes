// /discover — 5-step Wizard. Posts inputs to /api/discoveries, then routes
// to /discover/[id]. The interactive bits live in the client component.
import { requireUser } from '@/lib/auth';
import { DiscoverWizard } from './wizard';

export default async function DiscoverPage({
  searchParams,
}: { searchParams: { tripId?: string } }) {
  await requireUser();
  return <DiscoverWizard tripId={searchParams.tripId} />;
}
