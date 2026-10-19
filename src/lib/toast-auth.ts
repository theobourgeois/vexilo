import { openSignIn } from '@/lib/sign-in';
import { toast } from 'sonner';

const AUTH_REQUIRED_MESSAGE_PATTERN = /^You must be logged in to\b/i;

export const isAuthRequiredMessage = (message: string) =>
  AUTH_REQUIRED_MESSAGE_PATTERN.test(message.trim());

export const toastErrorWithLogin = (message: string) => {
  if (isAuthRequiredMessage(message)) {
    toast.error(message, {
      action: {
        label: 'Log in',
        onClick: () => void openSignIn(),
      },
    });
    return;
  }

  toast.error(message);
};
