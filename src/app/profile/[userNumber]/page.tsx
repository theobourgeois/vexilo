import { eq } from 'drizzle-orm';
import { notFound, permanentRedirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { profilePath } from '@/lib/post-slug';
import AnonymousProfile from './AnonymousProfile';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { robots: { index: false, follow: true } };

/** Old profile links (/profile/<number>) go to /@username. Anonymous people keep this page, which shows no name. */
export default async function LegacyProfilePage({ params }: { params: Promise<{ userNumber: string }> }) {
  const { userNumber } = await params;
  if (!UUID.test(userNumber)) notFound();
  const [user] = await db
    .select({ name: users.name, isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1);
  if (!user) notFound();
  if (!user.isAnonymous && user.name) permanentRedirect(profilePath(user.name));
  return <AnonymousProfile />;
}
