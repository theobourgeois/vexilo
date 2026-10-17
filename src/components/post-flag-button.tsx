import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/icons';

export function PostFlagButton() {
  return (
    <Button asChild>
      <Link href='/post-flag'>
        <Plus />
        Post flag
      </Link>
    </Button>
  );
}
