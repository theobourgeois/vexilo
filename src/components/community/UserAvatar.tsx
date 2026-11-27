import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** Someone's picture, or the first letter of their username. */
export default function UserAvatar({ username, image, className }: { username: string; image: string | null; className?: string }) {
  return (
    <Avatar className={cn('size-6 text-[11px]', className)}>
      <AvatarImage src={image || ''} alt='' />
      <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
