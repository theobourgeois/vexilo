'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Shuffle, Icon } from '@/components/icons';

// ============================================
// Generic Alert Banner Component
// ============================================

export type AlertBannerConfig = {
  /** Unique key for localStorage to track dismissal */
  id: string;
  /** Icon to display in the alert */
  icon?: Icon;
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
    <Alert className='flex items-center gap-3 py-2.5 pl-4 pr-2.5' variant={variant}>
      {Icon && <Icon className='size-4 shrink-0 text-main' />}
      <AlertDescription className='min-w-0 flex-1 text-[13.5px] text-subtle [&_strong]:font-semibold [&_strong]:text-foreground'>
        {message}
      </AlertDescription>
      {actionText && (onAction || href) && (
        <Button variant='neutral' size='sm' onClick={handleAction} className='shrink-0'>
          {actionText}
        </Button>
      )}
      {dismissible && (
        <Button variant='ghost' size='icon-sm' className='shrink-0' onClick={handleDismiss} aria-label='Dismiss'>
          <X />
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
  className = 'mx-auto max-w-[1312px] px-4 pt-4 md:px-8',
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
// Flag Maker Alert (specific implementation)
// ============================================

export function FlagMakerAlert() {
  const config: AlertBannerConfig = {
    id: 'flag-maker',
    icon: Shuffle,
    message: (
      <>
        <strong>You can now remix flags.</strong> Hit Remix on any flag, or make your own from scratch.
      </>
    ),
    actionText: 'Make a flag',
    href: '/create',
  };

  return (
    <div className='pt-6 empty:hidden'>
      <AlertBanner config={config} />
    </div>
  );
}
