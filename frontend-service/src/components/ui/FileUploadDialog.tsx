import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './button';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
}

export const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  open,
  onOpenChange,
  onUpload,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleUpload = () => {
    if (file) onUpload(file);
    setFile(null);
    onOpenChange(false);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 z-50">
          <Dialog.Title className="text-lg font-bold mb-2">
            Upload a file
          </Dialog.Title>
          {/* Dropzone + Clear call-to-action */}
          <div
            className={`mb-4 rounded-md border border-dashed p-4 text-sm cursor-pointer transition-colors ${
              dragOver
                ? 'bg-accent/40 border-primary'
                : 'bg-accent/20 hover:bg-accent/30'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role="button"
            aria-label="Choose a file to upload"
            title="Click to choose or drag & drop a file"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium">
                  {file ? file.name : 'Choose a file or drag & drop here'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  PDF recommended. Max size depends on server limits.
                </div>
              </div>
              <Button type="button" variant="secondary" className="shrink-0">
                Browse…
              </Button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button disabled={!file} onClick={handleUpload} type="button">
              Upload
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
