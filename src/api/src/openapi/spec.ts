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
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  top_k: { type: 'integer', minimum: 1, maximum: 10 },
                  paper_ids: { type: 'array', items: { type: 'string' } },
                },
                required: ['question'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'ok' },
          '400': { description: 'bad request' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/papers': {
      get: {
        responses: {
          '200': { description: 'ok' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/papers/{id}': {
      get: {
        responses: {
          '200': { description: 'ok' },
          '400': { description: 'bad request' },
          '404': { description: 'not found' },
          '500': { description: 'internal' },
        },
      },
      delete: {
        responses: {
          '200': { description: 'ok' },
          '400': { description: 'bad request' },
          '404': { description: 'not found' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/papers/{id}/stats': {
      get: {
        responses: {
          '200': { description: 'ok' },
          '400': { description: 'bad request' },
          '404': { description: 'not found' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/analytics/popular': {
      get: {
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          '200': { description: 'ok' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/queries/history': {
      get: {
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0 },
          },
        ],
        responses: {
          '200': { description: 'ok' },
          '500': { description: 'internal' },
        },
      },
    },
    '/api/v1/queries/{id}/rating': {
      patch: {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                },
                required: ['rating'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'ok' },
          '400': { description: 'bad request' },
          '404': { description: 'not found' },
          '500': { description: 'internal' },
        },
      },
    },
  },
};
