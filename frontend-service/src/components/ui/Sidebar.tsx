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
        'relative z-20 h-full border-r transition-[width] duration-200 ease-in-out',
        'bg-sidebar text-sidebar-foreground border-sidebar-border',
        // No top padding; header starts to the right of sidebar
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        'flex flex-col',
      ].join(' ')}
    >
      {/* Brand */}
      <div
        className={
          collapsed
            ? 'px-2 py-3 flex items-center justify-center'
            : 'px-3 py-3 flex items-center gap-2'
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="SageAI"
        >
          <path d="M12 18V5" />
          <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
          <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
          <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
          <path d="M18 18a4 4 0 0 0 2-7.464" />
          <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
          <path d="M6 18a4 4 0 0 1-2-7.464" />
          <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
        </svg>
        {!collapsed && (
          <span className="font-semibold tracking-tight">SageAI</span>
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
      <div className="sticky top-0 bg-sidebar border-b border-sidebar-border/60 px-3 py-2 flex items-center gap-2">
        {!collapsed && (
          <div className="text-sm font-semibold tracking-tight flex-1">
            Uploaded Files
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size={collapsed ? 'icon-sm' : 'sm'}
            variant="outline"
            onClick={() => setOpenUpload(true)}
            aria-label="Add file"
            title="Add file"
          >
            {collapsed ? <Plus className="size-4" /> : '+ Add File'}
          </Button>
        </div>
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
                  className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-sidebar-accent/60"
                  title={title}
                >
                  <FileText className="size-4 shrink-0 text-sidebar-foreground/80" />
                  {!collapsed && (
                    <span className="text-sm truncate flex-1">{title}</span>
                  )}
                  <button
                    className={
                      'p-1 text-muted-foreground hover:text-destructive transition-opacity ' +
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
