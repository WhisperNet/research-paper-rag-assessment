export const openapiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Research Paper RAG API',
    version: '0.1.0',
  },
  paths: {
    '/health/healthz': { get: { responses: { '200': { description: 'ok' } } } },
    '/health/readyz': {
      get: {
        responses: {
          '200': { description: 'ready' },
          '503': { description: 'not ready' },
        },
      },
    },
    '/api/v1/query': {
      post: { responses: { '501': { description: 'stub' } } },
    },
    '/api/v1/papers': {
      get: { responses: { '501': { description: 'stub' } } },
    },
    '/api/v1/analytics/popular': {
      get: { responses: { '501': { description: 'stub' } } },
    },
  },
};
