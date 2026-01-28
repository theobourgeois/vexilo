'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getUserData } from '@/actions/users';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Flag, LucideIcon } from 'lucide-react';

// ============================================
// Generic Alert Banner Component
// ============================================

export type AlertBannerConfig = {
  /** Unique key for localStorage to track dismissal */
  id: string;
  /** Icon to display in the alert */
  icon?: LucideIcon;
  /** Main message content - can be string or ReactNode for custom formatting */
  message: ReactNode;
  /** Call-to-action button text */
  actionText?: string;
  /** Action to perform when CTA is clicked */
  onAction?: () => void;
  /** Link to navigate to (alternative to onAction) */
  href?: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Custom condition to determine if alert should show (return true to show) */
  shouldShow?: () => boolean;
  /** Alert variant */
  variant?: 'default' | 'destructive';
};

type AlertBannerProps = {
  config: AlertBannerConfig;
  /** External loading state - alert won't show while loading */
  isLoading?: boolean;
};

export function AlertBanner({ config, isLoading = false }: AlertBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState(false);

  const {
    id,
    icon: Icon,
    message,
    actionText,
    onAction,
    href,
    dismissible = true,
    shouldShow,
    variant = 'default',
  } = config;

  const storageKey = `alert-dismissed-${id}`;

  // Check localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const dismissed = localStorage.getItem(storageKey);
    setIsDismissed(dismissed === 'true');
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setIsDismissed(true);
  };

  const handleAction = () => {
    handleDismiss();
    if (onAction) {
      onAction();
    } else if (href) {
      router.push(href);
    }
  };

  // Don't render until we've checked localStorage
  if (!isClient || isDismissed === null) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  // Don't show while loading
  if (isLoading) {
    return null;
  }

  // Check custom condition
  if (shouldShow && !shouldShow()) {
    return null;
  }

  return (
    <Alert className='relative' variant={variant}>
      {Icon && <Icon className='h-4 w-4' />}
      <AlertDescription className='flex items-center justify-between gap-4 pr-8'>
        <span>
          {message}
          {actionText && (onAction || href) && (
            <>
              {' '}
              <Button
                variant='default'
                className='py-0 px-2 h-auto font-semibold underline ml-1 cursor-pointer'
                onClick={handleAction}
              >
                {actionText}
              </Button>
            </>
          )}
        </span>
      </AlertDescription>
      {dismissible && (
        <Button
          variant='default'
          size='sm'
          className='absolute top-2 right-2 h-6 w-6 p-0 hover:bg-white/20 cursor-pointer'
          onClick={handleDismiss}
          aria-label='Dismiss'
        >
          <X className='h-4 w-4' />
        </Button>
      )}
    </Alert>
  );
}

// ============================================
// Alert Banner Container (renders multiple alerts)
// ============================================

type AlertBannerContainerProps = {
  alerts: Array<AlertBannerConfig & { isLoading?: boolean }>;
  className?: string;
};

export function AlertBannerContainer({
  alerts,
  className = 'max-w-7xl mx-auto px-4 pt-4',
}: AlertBannerContainerProps) {
  return (
    <div className={`${className} space-y-2`}>
      {alerts.map((alert) => (
        <AlertBanner
          key={alert.id}
          config={alert}
          isLoading={alert.isLoading}
        />
      ))}
    </div>
  );
}

// ============================================
// Profile Flag Alert (specific implementation)
// ============================================

export function ProfileFlagAlert() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: userData, isLoading: userDataLoading } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
    enabled: !!session?.user,
  });

  const isLoading =
    status === 'loading' || (!!session?.user && userDataLoading);

  // Determine if we should show the alert
  const shouldShow = () => {
    // Don't show if user already has a favorite flag
    if (session?.user && userData?.user?.favoriteFlag) {
      return false;
    }
    return true;
  };

  const handleAction = () => {
    if (session?.user) {
      router.push('/settings');
    } else {
      signIn('google');
    }
  };

  const config: AlertBannerConfig = {
    id: 'profile-flag',
    icon: Flag,
    message: (
      <>
        <strong>Show off your favorite flag!</strong> Add a flag badge to your
        profile picture.
      </>
    ),
    actionText: session?.user ? 'Go to Settings' : 'Sign in to get started',
    onAction: handleAction,
    shouldShow,
  };

  return (
    <div className='max-w-7xl mx-auto px-4 pt-4'>
      <AlertBanner config={config} isLoading={isLoading} />
    </div>
  );
}
