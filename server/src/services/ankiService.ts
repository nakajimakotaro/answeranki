import { TRPCError } from '@trpc/server';

const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

interface AnkiRequestParams {
  action: string;
  params?: Record<string, unknown>;
}

/**
 * Calls the AnkiConnect API.
 * @param input - The action and parameters for the AnkiConnect request.
 * @returns The JSON response from AnkiConnect.
 * @throws Throws an error if the fetch request itself fails or JSON parsing fails.
 */
export const callAnkiConnect = async <TResult = unknown>(
  input: AnkiRequestParams
): Promise<{ result: TResult | null; error: string | null }> => {
  const ankiRequest = {
    action: input.action,
    version: ANKI_CONNECT_VERSION,
    params: input.params ?? {},
  };

  // Let fetch errors (network, etc.) and JSON parsing errors propagate
  const response = await fetch(ANKI_CONNECT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ankiRequest),
  });

  // If !response.ok, response.json() is expected to fail if body is not valid JSON,
  // or it might return a JSON structure like { "result": null, "error": "..." }
  const data = (await response.json()) as { result: TResult | null; error: string | null };

  // Return the raw structure from AnkiConnect, including potential errors
  return data;
};
