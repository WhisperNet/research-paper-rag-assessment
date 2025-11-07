import * as React from 'react';
import { getHistory, type HistoryItem } from '@/lib/api';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';

function formatDT(dt?: string) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

const HistoryPage = () => {
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<HistoryItem | null>(null);

  React.useEffect(() => {
    setLoading(true);
    getHistory(30, 0)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const viewAnswer = (item: HistoryItem) => {
    setSelected(item);
    setOpen(true);
  };

  return (
    <div className="w-full max-w-3xl mx-auto pt-24 pb-12 px-4 h-full flex flex-col">
      <h2 className="font-bold text-2xl mb-4">Query &amp; Chat History</h2>
      {loading && (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      )}
      {error && <div className="text-center text-red-500 py-4">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No history found.
        </div>
      )}
      <div className="space-y-4 overflow-y-auto flex-1 pr-1">
        {items.map((item) => (
          <div
            key={item._id}
            className="p-4 bg-card border rounded-md shadow-sm hover:shadow-md transition flex flex-col"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="font-semibold flex-1 text-md truncate">
                {item.question}
              </div>
              <div className="flex gap-4 text-xs items-center min-w-max">
                {typeof item.rating === 'number' && (
                  <span className="inline-flex rounded bg-indigo-100 text-indigo-700 px-2 py-0.5">
                    Rated: {item.rating}/5
                  </span>
                )}
                {typeof item.confidence === 'number' && (
                  <span className="inline-flex rounded bg-emerald-100 text-emerald-700 px-2 py-0.5">
                    Confidence {(item.confidence * 100).toFixed(1)}%
                  </span>
                )}
                <span className="text-muted-foreground">
                  {formatDT(item.created_at)}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex flex-row flex-wrap gap-2">
              {(item.paper_ids?.length ?? 0) > 0 && (
                <span>
                  Papers:
                  {item.paper_ids?.map((id, idx) => (
                    <span key={id} className="ml-1">
                      {id}
                      {idx < (item.paper_ids?.length ?? 0) - 1 ? ',' : ''}
                    </span>
                  ))}
                </span>
              )}
              {item.retrieval_time_ms && (
                <span>Retrieval: {item.retrieval_time_ms}ms</span>
              )}
              {item.gen_time_ms && <span>Gen: {item.gen_time_ms}ms</span>}
              {item.total_time_ms && <span>Total: {item.total_time_ms}ms</span>}
            </div>
            {item.answer && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => viewAnswer(item)}
                >
                  View answer
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Answer Dialog */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 z-50">
            <Dialog.Title className="text-lg font-bold mb-2">
              Answer
            </Dialog.Title>
            <div className="text-sm whitespace-pre-wrap">
              {selected?.answer || 'Answer not stored for this entry.'}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default HistoryPage;
