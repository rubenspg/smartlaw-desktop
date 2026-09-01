// Helpers for consuming the typed Hono client.
//
// On a non-2xx response the body shape is not part of the typed contract — the
// server returns `{ error: string }` by convention. Narrowing that in one place
// keeps the `error` cast out of every hook.

import type { QueryClient } from '@tanstack/react-query';

interface ErrorBody {
  error?: string;
}

/**
 * Invalidate every dashboard query. Call from any mutation that changes a
 * counted entity (cliente, processo, tarefa, andamento) so the home figures,
 * pendências and recent-activity feed refresh immediately instead of waiting
 * for their staleTime.
 */
export function invalidateDashboard(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

/** A minimal view of the fetch Response fields these helpers use. */
interface ResponseLike {
  ok: boolean;
  json: () => Promise<unknown>;
}

/**
 * Return the parsed JSON body of a successful response, or throw an Error
 * carrying the server's message (falling back to `fallback`).
 */
export async function unwrap<T>(res: ResponseLike, fallback: string): Promise<T> {
  if (!res.ok) {
    throw new Error(await errorMessage(res, fallback));
  }
  return res.json() as Promise<T>;
}

/** Extract the server's error message from a failed response. */
export async function errorMessage(res: ResponseLike, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  return body.error ?? fallback;
}
