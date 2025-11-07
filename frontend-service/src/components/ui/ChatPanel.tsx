import { Input } from '@/components/ui/input';
import { Button } from './button';
import * as React from 'react';
import {
  askQuestion,
  type QueryResponse,
  type Citation,
  findRecentHistoryIdByQuestion,
  rateQuery,
  listPapers,
  type PaperItem,
} from '@/lib/api';
import * as Dialog from '@radix-ui/react-dialog';
import { SlidersHorizontal, Files, Download, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const STORAGE_KEY = 'whispernet:chat:v1';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  meta?: {
    confidence?: number;
    citations?: Citation[];
    historyId?: string;
    rating?: number;
  };
};

const ChatPanel = () => {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          messages?: ChatMessage[];
          input?: string;
        };
        if (Array.isArray(parsed?.messages))
          return parsed.messages as ChatMessage[];
      }
    } catch {}
    return [];
  });
  const [input, setInput] = React.useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          messages?: ChatMessage[];
          input?: string;
        };
        if (typeof parsed?.input === 'string') return parsed.input;
      }
    } catch {}
    return '';
  });
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Query controls
  const [topK, setTopK] = React.useState<number>(5);
  const [papers, setPapers] = React.useState<PaperItem[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = React.useState<string[]>([]);
  const [openK, setOpenK] = React.useState(false);
  const [openPapers, setOpenPapers] = React.useState(false);

  // Clear chat handler
  const handleClear = () => {
    if (confirm('Clear chat history on this device?')) {
      setMessages([]);
      setInput('');
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  };

  // Download chat as markdown
  const handleDownload = () => {
    if (messages.length === 0) {
      alert('No chat history to download.');
      return;
    }

    let markdown = '# Chat History\n\n';
    markdown += `*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;

    messages.forEach((m, idx) => {
      const time = new Date(m.createdAt).toLocaleString();
      if (m.role === 'user') {
        markdown += `## User (${time})\n\n${m.content}\n\n`;
      } else {
        markdown += `## Assistant (${time})\n\n${m.content}\n\n`;

        // Add metadata if available
        if (m.meta?.confidence !== undefined) {
          markdown += `*Confidence: ${(m.meta.confidence * 100).toFixed(
            1
          )}%*\n\n`;
        }

        // Add citations
        if (m.meta?.citations && m.meta.citations.length > 0) {
          markdown += `### Citations\n\n`;
          m.meta.citations.forEach((c, cidx) => {
            markdown += `${cidx + 1}. **${c.paper_title || 'Unknown'}**`;
            if (c.section) markdown += ` - ${c.section}`;
            if (c.page !== undefined) markdown += ` (p. ${c.page})`;
            if (c.relevance_score !== undefined) {
              markdown += ` - Relevance: ${(c.relevance_score * 100).toFixed(
                1
              )}%`;
            }
            markdown += '\n';
          });
          markdown += '\n';
        }

        // Add rating if available
        if (m.meta?.rating !== undefined) {
          markdown += `*User Rating: ${m.meta.rating}/5*\n\n`;
        }
      }

      // Add separator between messages
      if (idx < messages.length - 1) {
        markdown += '---\n\n';
      }
    });

    // Create download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-history-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    // Load papers for selector
    (async () => {
      try {
        const items = await listPapers();
        setPapers(items);
      } catch {}
    })();
  }, []);

  // Persist to localStorage whenever messages or input changes
  React.useEffect(() => {
    try {
      const payload = JSON.stringify({ messages, input });
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {}
  }, [messages, input]);

  const scrollToBottom = React.useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const submitQuestion = React.useCallback(
    async (question: string) => {
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const resp: QueryResponse = await askQuestion(
          question,
          topK,
          selectedPaperIds.length ? selectedPaperIds : undefined
        );
        // attempt to resolve the stored history id for rating
        let historyId: string | null = null;
        try {
          historyId = await findRecentHistoryIdByQuestion(question);
        } catch {}

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resp?.answer || '',
          createdAt: Date.now(),
          meta: {
            confidence: resp?.confidence,
            citations: resp?.citations,
            historyId: historyId || undefined,
          },
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Sorry, something went wrong while processing your question.',
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
      }
    },
    [topK, selectedPaperIds]
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    await submitQuestion(question);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const question = input.trim();
      if (!question || loading) return;
      setInput('');
      void submitQuestion(question);
    }
  };

  const handleRate = async (msgId: string, rating: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, meta: { ...m.meta, rating } } : m
      )
    );
    const msg = messages.find((m) => m.id === msgId);
    const historyId = msg?.meta?.historyId;
    if (!historyId) return; // quietly ignore if we couldn't resolve id
    try {
      await rateQuery(historyId, rating);
    } catch {
      // best-effort; if it fails, keep UI state
    }
  };

  const renderAssistantFooter = (m: ChatMessage) => {
    const conf = m.meta?.confidence;
    const citations = m.meta?.citations || [];
    const isOpen = !!expanded[m.id];

    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {typeof conf === 'number' && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
            Confidence: {(conf * 100).toFixed(1)}%
          </span>
        )}
        {citations.length > 0 && (
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => setExpanded((s) => ({ ...s, [m.id]: !isOpen }))}
          >
            {isOpen ? 'Hide citations' : 'View citations'} ({citations.length})
          </button>
        )}
        {/* Rating controls */}
        <span className="ml-auto"></span>
        <div className="flex items-center gap-1">
          <span className="mr-1">Rate:</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className={`size-6 rounded-full border text-xs ${
                m.meta?.rating && m.meta.rating >= r
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
              onClick={() => handleRate(m.id, r)}
              title={`${r}`}
              aria-label={`Rate ${r}`}
            >
              {r}
            </button>
          ))}
          {m.meta?.rating && (
            <span className="ml-2 text-foreground">Thanks!</span>
          )}
        </div>
      </div>
    );
  };

  const renderCitations = (m: ChatMessage) => {
    const citations = m.meta?.citations || [];
    const isOpen = !!expanded[m.id];
    if (!isOpen || citations.length === 0) return null;
    return (
      <div className="mt-2 rounded-md border bg-background p-3">
        <div className="mb-1 text-xs font-semibold">Citations</div>
        <ul className="space-y-1 text-xs">
          {citations.map((c, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {c.paper_title || 'Unknown'}
                {c.section ? `, ${c.section}` : ''}
                {typeof c.page === 'number' ? `, p.${c.page}` : ''}
              </span>
              {typeof c.relevance_score === 'number' && (
                <span className="shrink-0 text-muted-foreground">
                  {(c.relevance_score * 100).toFixed(1)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section className="flex flex-col w-full max-w-none mx-auto pt-24 pb-8 h-full">
      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <button
          onClick={handleDownload}
          disabled={loading || messages.length === 0}
          className="size-12 rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          aria-label="Download chat as Markdown"
          title="Download chat as Markdown"
        >
          <Download className="size-5" />
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className="size-12 rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          aria-label="Clear chat"
          title="Clear chat"
        >
          <Trash2 className="size-5" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Ask a question to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === 'user' ? 'text-right' : 'text-left'}
                >
                  <div
                    className={
                      'inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm border ' +
                      (m.role === 'user'
                        ? 'bg-primary text-primary-foreground border-primary/40'
                        : 'bg-accent/40 text-foreground border-border')
                    }
                  >
                    {m.role === 'assistant' ? (
                      <div className="markdown-body">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: (props) => (
                              <a {...props} target="_blank" rel="noreferrer" />
                            ),
                            code: (props) => {
                              const { children, className, node, ...rest } =
                                props;
                              const match = /language-(\w+)/.exec(
                                className || ''
                              );
                              const isInline = !match;
                              return isInline ? (
                                <code className={className} {...rest}>
                                  {children}
                                </code>
                              ) : (
                                <pre className={className}>
                                  <code {...rest}>{children}</code>
                                </pre>
                              );
                            },
                          }}
                        >
                          {m.content || ''}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                    <div className="mt-1 text-[10px] opacity-70">
                      {formatTime(m.createdAt)}
                    </div>
                    {m.role === 'assistant' && renderAssistantFooter(m)}
                    {m.role === 'assistant' && renderCitations(m)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-left">
                  <div className="inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm border bg-accent/40 text-foreground border-border">
                    <span className="inline-flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/70"></span>
                      </span>
                      Typing...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 mt-4 md:mt-6">
        <form
          className="mx-auto w-full max-w-3xl flex items-center gap-2"
          onSubmit={onSubmit}
        >
          <div className="relative flex-1">
            <Input
              className="w-full pr-24"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* Top-K dialog */}
              <Dialog.Root open={openK} onOpenChange={setOpenK}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-md border bg-background hover:bg-accent text-muted-foreground"
                    title="Top K (relevant chunks)"
                    aria-label="Top K"
                  >
                    <SlidersHorizontal className="size-4 mx-auto" />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                  <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 z-50">
                    <Dialog.Title className="text-lg font-bold mb-2">
                      Top K
                    </Dialog.Title>
                    <div className="text-sm mb-4 text-muted-foreground">
                      Choose number of most relevant chunks
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={topK}
                        onChange={(e) =>
                          setTopK(
                            Math.max(
                              1,
                              Math.min(10, Number(e.target.value) || 5)
                            )
                          )
                        }
                        className="flex-1"
                      />
                      <span className="w-10 text-center text-sm font-semibold">
                        {topK}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => setOpenK(false)}
                        type="button"
                      >
                        Done
                      </Button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Papers multi-select dialog */}
              <Dialog.Root open={openPapers} onOpenChange={setOpenPapers}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-md border bg-background hover:bg-accent text-muted-foreground"
                    title="Choose papers (optional)"
                    aria-label="Choose papers"
                  >
                    <Files className="size-4 mx-auto" />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                  <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 z-50">
                    <Dialog.Title className="text-lg font-bold mb-2">
                      Select papers
                    </Dialog.Title>
                    <div className="text-sm mb-3 text-muted-foreground">
                      Pick one or more papers to constrain context. Leave empty
                      for "All papers".
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {papers.map((p) => {
                        const checked = selectedPaperIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedPaperIds((prev) =>
                                  e.target.checked
                                    ? [...prev, p.id]
                                    : prev.filter((id) => id !== p.id)
                                );
                              }}
                            />
                            <span
                              className="truncate"
                              title={p.title || p.filename}
                            >
                              {p.title || p.filename}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {selectedPaperIds.length
                          ? `${selectedPaperIds.length} selected`
                          : 'All papers'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setSelectedPaperIds([])}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="default"
                          type="button"
                          onClick={() => setOpenPapers(false)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default ChatPanel;
