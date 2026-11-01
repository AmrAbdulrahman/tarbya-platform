import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: '../../apps/api/openapi.json',
    output: {
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: { path: 'src/fetcher.ts', name: 'apiFetch' },
      },
    },
  },
});
