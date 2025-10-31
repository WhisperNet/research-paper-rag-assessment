import * as React from 'react';
import {
  getApiHealth,
  type ApiHealth,
  getEmbedderHealth,
  type EmbedderHealth,
  getApiLiveness,
  type ApiLiveness,
} from '@/lib/api';
import { Button } from '@/components/ui/button';

const StatusPill: React.FC<{
  ok: boolean;
  label: string;
  message?: string;
}> = ({ ok, label, message }) => (
  <div
    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    }`}
  >
    <span
      className={`size-2 rounded-full ${ok ? 'bg-emerald-600' : 'bg-red-600'}`}
    ></span>
    <span className="font-medium">{label}</span>
    {!ok && message && <span className="opacity-80">— {message}</span>}
  </div>
);

const HealthPage = () => {
  const [apiHealth, setApiHealth] = React.useState<ApiHealth | null>(null);
  const [apiLive, setApiLive] = React.useState<ApiLiveness | null>(null);
  const [embedHealth, setEmbedHealth] = React.useState<EmbedderHealth | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // track individual failures so we can still render other sections
  const [apiHealthErr, setApiHealthErr] = React.useState<string | null>(null);
  const [apiLiveErr, setApiLiveErr] = React.useState<string | null>(null);
  const [embedErr, setEmbedErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiHealthErr(null);
    setApiLiveErr(null);
    setEmbedErr(null);

    // Run calls in parallel but capture individual errors
    await Promise.all([
      (async () => {
        try {
          const h = await getApiHealth();
          setApiHealth(h);
        } catch (e: any) {
          setApiHealth(null);
          setApiHealthErr(e?.message || 'unreachable');
        }
      })(),
      (async () => {
        try {
          const l = await getApiLiveness();
          setApiLive(l);
        } catch (e: any) {
          setApiLive(null);
          setApiLiveErr(e?.message || 'unreachable');
        }
      })(),
      (async () => {
        try {
          const emb = await getEmbedderHealth();
          setEmbedHealth(emb);
        } catch (e: any) {
          setEmbedHealth(null);
          setEmbedErr(e?.message || 'unreachable');
        }
      })(),
    ]).catch((e) => {
      console.error(e);
      // Do not surface a global error; individual errors are shown per section
      setError(null);
    });

    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full max-w-4xl mx-auto pt-24 pb-12 px-4 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-2xl">Service Health</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-8">
          Checking services…
        </div>
      )}
      {error && <div className="text-center text-red-500 py-4">{error}</div>}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="bg-card border rounded-md shadow-sm p-4">
            <div className="font-semibold mb-3">Backend API</div>
            <div className="flex flex-wrap gap-2 mb-3">
              <StatusPill
                ok={apiLive?.status === 'ok'}
                label="Liveness (/healthz)"
                message={apiLive ? undefined : apiLiveErr || 'unreachable'}
              />
            </div>
            <div
              className={`mt-1 text-sm ${
                apiHealth?.ready ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              Overall:{' '}
              {apiHealth
                ? apiHealth.ready
                  ? 'Ready'
                  : 'Degraded'
                : 'Unreachable'}
            </div>
          </div>

          <div className="bg-card border rounded-md shadow-sm p-4">
            <div className="font-semibold mb-3">Backend Dependencies</div>
            <div className="flex flex-wrap gap-2">
              <StatusPill
                ok={!!apiHealth?.details.mongo?.ok}
                label="Mongo"
                message={
                  apiHealth
                    ? apiHealth.details.mongo.message
                    : apiHealthErr || 'unreachable'
                }
              />
              <StatusPill
                ok={!!apiHealth?.details.redis?.ok}
                label="Redis"
                message={
                  apiHealth
                    ? apiHealth.details.redis.message
                    : apiHealthErr || 'unreachable'
                }
              />
              <StatusPill
                ok={!!apiHealth?.details.qdrant?.ok}
                label="Qdrant"
                message={
                  apiHealth
                    ? apiHealth.details.qdrant.message
                    : apiHealthErr || 'unreachable'
                }
              />
              <StatusPill
                ok={!!apiHealth?.details.ollama?.ok}
                label="Ollama"
                message={
                  apiHealth
                    ? apiHealth.details.ollama.message
                    : apiHealthErr || 'unreachable'
                }
              />
            </div>
          </div>

          <div className="bg-card border rounded-md shadow-sm p-4">
            <div className="font-semibold mb-3">Embedder Service</div>
            <div className="flex flex-wrap gap-2">
              <StatusPill
                ok={embedHealth?.status === 'ok'}
                label="Embedder"
                message={embedHealth ? undefined : embedErr || 'unreachable'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthPage;
