import { Button } from './button';
import * as React from 'react';
import { FileUploadDialog } from './FileUploadDialog';
import { DeleteFileDialog } from './DeleteFileDialog';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  BrainIcon,
} from 'lucide-react';
import {
  listPapers,
  uploadPaper,
  deletePaper,
  type PaperItem,
} from '@/lib/api';

const EXPANDED_WIDTH = 'w-72'; // ~288px
const COLLAPSED_WIDTH = 'w-16'; // ~64px

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
};

const Sidebar = ({ collapsed, onToggleCollapsed }: SidebarProps) => {
  const [openUpload, setOpenUpload] = React.useState(false);
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    file?: { id: string; title: string };
  }>({ open: false });
  const [files, setFiles] = React.useState<PaperItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await listPapers();
      setFiles(items);
    } catch {
      // noop for now
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFileUpload = async (file: File) => {
    try {
      await uploadPaper(file);
      await refresh();
    } catch {
      // noop for now
    } finally {
      setOpenUpload(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await deletePaper(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      // noop for now
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  return (
    <aside
      className={[
        'relative z-40 h-full border-r transition-[width] duration-200 ease-in-out',
        'bg-background text-foreground border-border',
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        'flex flex-col',
      ].join(' ')}
    >
      {/* Brand - Same height as header (h-16) */}
      <div
        className={`
          h-16 border-b border-border flex items-center
          ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'}
        `}
      >
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
          <BrainIcon className="size-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight">SageAI</span>
            <span className="text-xs text-muted-foreground">
              Research Assistant
            </span>
          </div>
        )}
      </div>

      {/* Floating middle collapse/expand handle */}
      <button
        className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-30 size-7 rounded-full border bg-background shadow hover:shadow-md flex items-center justify-center"
        onClick={() => onToggleCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </button>

      {/* Sticky top controls */}
      <div className="sticky top-0 bg-background border-b border-border px-3 py-3 flex items-center gap-2">
        {!collapsed && (
          <div className="text-sm font-semibold tracking-tight flex-1">
            Papers
          </div>
        )}
        <Button
          size={collapsed ? 'icon' : 'sm'}
          variant="outline"
          onClick={() => setOpenUpload(true)}
          aria-label="Add file"
          title="Add file"
          className={collapsed ? 'mx-auto' : ''}
        >
          {collapsed ? (
            <Plus className="size-4" />
          ) : (
            <>
              <Plus className="size-4 mr-1" /> Add
            </>
          )}
        </Button>
      </div>

      {/* Scrollable file list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-1">
          {loading && (
            <li className="text-xs text-muted-foreground px-2 py-1">
              Loading...
            </li>
          )}
          {!loading && files.length === 0 && (
            <li className="text-xs text-muted-foreground px-2 py-1">
              No files yet
            </li>
          )}
          {!loading &&
            files.map((file) => {
              const title = file.title || file.filename || 'File';
              return (
                <li
                  key={file.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors"
                  title={title}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  {!collapsed && (
                    <span className="text-sm truncate flex-1">{title}</span>
                  )}
                  <button
                    className={
                      'p-1 text-muted-foreground hover:text-destructive transition-all ' +
                      (collapsed
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100')
                    }
                    onClick={() =>
                      setDeleteDialog({
                        open: true,
                        file: { id: file.id, title },
                      })
                    }
                    aria-label="Delete file"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
        </ul>
      </div>

      {/* Dialogs */}
      <FileUploadDialog
        open={openUpload}
        onOpenChange={setOpenUpload}
        onUpload={handleFileUpload}
      />
      <DeleteFileDialog
        open={deleteDialog.open}
        onOpenChange={(v) =>
          setDeleteDialog({ open: v, file: deleteDialog.file })
        }
        onDelete={() =>
          deleteDialog.file && handleFileDelete(deleteDialog.file.id)
        }
        fileName={deleteDialog.file?.title}
      />
    </aside>
  );
};

export default Sidebar;
