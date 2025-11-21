import { createToaster } from '@chakra-ui/react';

/**
 * Centralized toast notification helpers for the app.
 * Uses Chakra UI v3's createToaster API.
 */
export const toaster = createToaster({
  placement: 'top-end',
  pauseOnPageIdle: true,
});

/**
 * Helper functions for common toast patterns
 */
export const showSuccessToast = (title: string, description?: string) => {
  toaster.success({
    title,
    description,
  });
};

export const showErrorToast = (title: string, description?: string) => {
  toaster.error({
    title,
    description,
  });
};

export const showInfoToast = (title: string, description?: string) => {
  toaster.info({
    title,
    description,
  });
};

export const showWarningToast = (title: string, description?: string) => {
  toaster.warning({
    title,
    description,
  });
};
