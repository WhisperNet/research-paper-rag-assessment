import * as React from 'react';
import { getPopularTopicInsight, type PopularTopicInsight } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TrendingUp, BookOpen, Brain, Sparkles } from 'lucide-react';

const MostDiscussedPage = () => {
  const [data, setData] = React.useState<PopularTopicInsight | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    getPopularTopicInsight()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const confidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const confidenceLabel = (conf: number) => {
    if (conf >= 0.8) return 'High';
    if (conf >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="w-full max-w-6xl mx-auto pt-24 pb-12 px-6 h-full overflow-y-auto">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <TrendingUp className="w-8 h-8 text-primary" />
          <h1 className="font-bold text-3xl">Most Discussed Topic</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
          AI-powered analysis of the top 10 most frequently asked questions,
          identifying common themes and providing research-backed insights
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">
            Analyzing questions and generating insights...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
          <p className="text-destructive font-medium">Insufficient data</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Topic Card */}
          <div className="bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-8 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2 text-foreground">
                  {data.topic}
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Confidence:{' '}
                    <span
                      className={`font-semibold ${confidenceColor(
                        data.confidence
                      )}`}
                    >
                      {confidenceLabel(data.confidence)} (
                      {(data.confidence * 100).toFixed(0)}%)
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {data.sources_used.length} source
                    {data.sources_used.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Insight Card */}
          <div className="bg-card border rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Research Insight
            </h3>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.insight}
              </ReactMarkdown>
            </div>
          </div>

          {/* Two Column Layout for Citations and Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Citations Card */}
            {data.citations && data.citations.length > 0 && (
              <div className="bg-card border rounded-xl shadow-md p-6">
                <h3 className="font-semibold text-lg mb-4">Citations</h3>
                <div className="space-y-3">
                  {data.citations.map((citation, idx) => (
                    <div
                      key={idx}
                      className="bg-accent/30 rounded-lg p-3 text-sm border border-accent"
                    >
                      <div className="font-medium text-foreground mb-1">
                        {citation.paper_title || 'Unknown Paper'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {citation.section && `${citation.section}`}
                          {citation.page && `, Page ${citation.page}`}
                        </span>
                        {citation.relevance_score !== undefined && (
                          <span className="font-mono">
                            {(citation.relevance_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Analyzed Card */}
            <div className="bg-card border rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-lg mb-4">
                Questions Analyzed ({data.questions_analyzed.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.questions_analyzed.map((question, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm bg-accent/20 rounded-lg p-3 border border-accent/50"
                  >
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-xs font-medium shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-foreground/90">{question}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sources Used Card */}
          {data.sources_used && data.sources_used.length > 0 && (
            <div className="bg-card border rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-lg mb-4">
                Research Papers Referenced
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.sources_used.map((source, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm border border-primary/20"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MostDiscussedPage;
