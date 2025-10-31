import * as React from 'react';
import { getPopular, type PopularAnalytics } from '@/lib/api';

const AnalyticsPage = () => {
  const [data, setData] = React.useState<PopularAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    getPopular(20)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto pt-24 pb-12 px-4 h-full flex flex-col">
      <h2 className="font-bold text-2xl mb-4 text-center">Analytics</h2>
      {loading && (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      )}
      {error && <div className="text-center text-red-500 py-4">{error}</div>}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto">
          <div className="bg-card border rounded-md shadow-sm p-4">
            <h3 className="font-semibold mb-3">Top Questions</h3>
            <ol className="space-y-2 text-sm">
              {(data?.top_questions ?? []).map((q, idx) => (
                <li key={q.question + idx} className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-accent text-xs">
                    {idx + 1}
                  </span>
                  <span className="truncate flex-1" title={q.question}>
                    {q.question}
                  </span>
                  <span className="text-muted-foreground">{q.count}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-card border rounded-md shadow-sm p-4">
            <h3 className="font-semibold mb-3">Top Papers Referenced</h3>
            <ol className="space-y-2 text-sm">
              {(data?.top_papers ?? []).map((p, idx) => (
                <li key={p.paper_id} className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center size-5 rounded bg-accent text-xs">
                    {idx + 1}
                  </span>
                  <span
                    className="truncate flex-1"
                    title={p.paper_title || p.paper_id}
                  >
                    {p.paper_title || p.paper_id}
                  </span>
                  <span className="text-muted-foreground">{p.count}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
