import type { Metadata } from 'next';
import { getMyFlags } from '@/actions/my-flags';
import MyFlags, { MyFlagsSignedOut } from './MyFlags';

export const metadata: Metadata = {
  title: 'My flags - Vexilo',
  description: 'The flags you’ve designed in the Vexilo flag maker, posted or not.',
  robots: { index: false },
};

export default async function MyFlagsPage() {
  const flags = await getMyFlags();
  if (!flags) return <MyFlagsSignedOut />;
  return <MyFlags flags={flags} />;
}
