import { Input } from '@/components/ui/input';
import { Button } from './button';
import * as React from 'react';
import { askQuestion, type QueryResponse, type Citation } from '@/lib/api';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  meta?: { confidence?: number; citations?: Citation[] };
};

const ChatPanel = () => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const submitQuestion = React.useCallback(async (question: string) => {
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
      const resp: QueryResponse = await askQuestion(question);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp?.answer || '',
        createdAt: Date.now(),
        meta: { confidence: resp?.confidence, citations: resp?.citations },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong while processing your question.',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const renderAssistantFooter = (m: ChatMessage) => {
    const conf = m.meta?.confidence;
    const citations = m.meta?.citations || [];
    const isOpen = !!expanded[m.id];

    return (
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
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
                    {m.content}
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
          <Input
            className="flex-1"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              className="lucide lucide-send-icon lucide-send"
            >
              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
              <path d="m21.854 2.147-10.94 10.939" />
            </svg>
          </Button>
        </form>
      </div>
    </section>
  );
};

export default ChatPanel;
