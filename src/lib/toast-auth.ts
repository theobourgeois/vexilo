import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

const AUTH_REQUIRED_MESSAGE_PATTERN = /^You must be logged in to\b/i;

export const isAuthRequiredMessage = (message: string) =>
  AUTH_REQUIRED_MESSAGE_PATTERN.test(message.trim());

export const toastErrorWithLogin = (message: string) => {
  if (isAuthRequiredMessage(message)) {
    toast.error(message, {
      action: {
        label: 'Log in',
        onClick: () => void signIn('google'),
      },
    });
    return;
  }

  toast.error(message);
};
