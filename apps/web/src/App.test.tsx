import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.tsx';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('application shell', () => {
  it('introduces the product and reports API readiness', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'lineup-engine-api',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /build a lineup\s*by intent/i,
    );
    expect(await screen.findByText('System ready')).toBeVisible();
  });
});
