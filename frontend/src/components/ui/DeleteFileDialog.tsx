import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './button';

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  fileName?: string;
}

export const DeleteFileDialog: React.FC<DeleteFileDialogProps> = ({
  open,
  onOpenChange,
  onDelete,
  fileName,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 z-50">
          <Dialog.Title className="text-lg font-bold mb-2">
            Delete File
          </Dialog.Title>
          <div className="mb-4">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{fileName || 'this file'}</span>?
            This action cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} type="button">
              Delete
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
