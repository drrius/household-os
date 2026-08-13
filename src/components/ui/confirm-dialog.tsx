"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  cancelLabel?: string;
  // Required unless `confirmSlot` is given.
  confirmLabel?: string;
  // Rendered in the footer instead of the default confirm button, so a caller
  // can submit a server action with hidden inputs from inside the dialog.
  confirmSlot?: ReactNode;
  confirmVariant?: "destructive" | "default";
  description: ReactNode;
  onConfirm?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
};

// Controlled only: confirming does not close the dialog, because the caller
// owns what happens next. Cancel and Escape close it.
export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  confirmSlot,
  confirmVariant = "destructive",
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps): ReactNode {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button autoFocus variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          {confirmSlot ?? (
            <Button onClick={onConfirm} variant={confirmVariant}>
              {confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
