import React from 'react';
import {
  Dialog as ChakraDialog,
  Portal,
} from '@chakra-ui/react';

// Re-export Chakra UI Dialog components with the names expected by HalftimeModal
export const DialogRoot = ChakraDialog.Root;
export const DialogBackdrop = ChakraDialog.Backdrop;
export const DialogContent = ChakraDialog.Content;
export const DialogHeader = ChakraDialog.Header;
export const DialogBody = ChakraDialog.Body;
export const DialogFooter = ChakraDialog.Footer;
export const DialogCloseTrigger = ChakraDialog.CloseTrigger;
export const DialogTitle = ChakraDialog.Title;
export const DialogDescription = ChakraDialog.Description;

export { Portal };
