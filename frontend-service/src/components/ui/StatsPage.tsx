import * as React from 'react';
import {
  listPapers,
  type PaperItem,
  getPaperStats,
  type PaperStats,
} from '@/lib/api';

const Row: React.FC<{ paper: PaperItem; stats?: PaperStats | null }> = ({
  paper,
  stats,
}) => {
  return (
    <div className="w-full border-b py-3 px-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <div className="md:w-2/5">
        <div className="font-semibold wrap-break-word">
          {paper.title || paper.filename}
        </div>
        <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
          <span>Status: {paper.status || 'unknown'}</span>
          {paper.indexed_at && (
            <span>Indexed: {new Date(paper.indexed_at).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded bg-accent/40 p-2 text-center">
          <div className="text-xs text-muted-foreground">Chunks</div>
          <div className="font-bold">{stats ? stats.chunk_count : '—'}</div>
        </div>
        <div className="rounded bg-accent/40 p-2 text-center">
          <div className="text-xs text-muted-foreground">Vectors</div>
          <div className="font-bold">{stats ? stats.vector_count : '—'}</div>
        </div>
        <div className="rounded bg-accent/40 p-2 text-center col-span-2 md:col-span-2">
          <div className="text-xs text-muted-foreground">Paper ID</div>
          <div className="font-mono text-xs break-all">
            {stats ? stats.paper_id : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsPage = () => {
  const [papers, setPapers] = React.useState<PaperItem[]>([]);
  const [statsMap, setStatsMap] = React.useState<
    Record<string, PaperStats | null>
  >({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const items = await listPapers();
        setPapers(items);
        const results = await Promise.all(
          items.map(async (p) => {
            try {
              const s = await getPaperStats(p.id);
              return [p.id, s] as const;
            } catch {
              return [p.id, null] as const;
            }
          })
        );
        const map: Record<string, PaperStats | null> = {};
        for (const [id, s] of results) map[id] = s;
        setStatsMap(map);
      } catch (e: any) {
        setError(e?.message || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto pt-24 pb-12 px-4 h-full flex flex-col">
      <h2 className="font-bold text-2xl mb-4 text-center">Paper Stats</h2>
      {loading && (
        <div className="text-center text-muted-foreground py-8">Loading…</div>
      )}
      {error && <div className="text-center text-red-500 py-4">{error}</div>}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto">
          <div className="w-full border rounded-md overflow-hidden">
            {papers.map((p) => (
              <Row key={p.id} paper={p} stats={statsMap[p.id]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
