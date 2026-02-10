import { useState, useCallback } from 'react';
import type { DraftOrderApiResponse, OptionSelection } from '../types';

interface UseDraftOrderOptions {
  apiUrl: string;
  apiKey: string;
}

interface CreateDraftOrderParams {
  productId: string;
  width: number;
  height: number;
  quantity: number;
  options?: OptionSelection[];
}

interface UseDraftOrderReturn {
  createDraftOrder: (params: CreateDraftOrderParams) => Promise<DraftOrderApiResponse>;
  creating: boolean;
  error: string | null;
}

/**
 * Manages Draft Order creation.
 *
 * - Exposes createDraftOrder async function
 * - Tracks creating (boolean) and error (string | null) states
 * - POSTs to /api/v1/draft-orders with JSON body
 * - Sends X-API-Key header and Content-Type: application/json
 * - Returns DraftOrderApiResponse on success
 * - Handles RFC 7807 errors
 */
export function useDraftOrder(options: UseDraftOrderOptions): UseDraftOrderReturn {
  const { apiUrl, apiKey } = options;

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDraftOrder = useCallback(
    async (params: CreateDraftOrderParams): Promise<DraftOrderApiResponse> => {
      const { productId, width, height, quantity, options } = params;

      setCreating(true);
      setError(null);

      try {
        const url = `${apiUrl}/api/v1/draft-orders`;

        // Build POST body with optional options field
        const body: Record<string, unknown> = {
          productId,
          width,
          height,
          quantity,
        };

        // Include options only if provided and not empty
        if (options && options.length > 0) {
          body.options = options;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          // Handle RFC 7807 error response
          if (response.status === 401) {
            const errorMsg = 'Authentication failed';
            setError(errorMsg);
            setCreating(false);
            throw new Error(errorMsg);
          }

          const errorData = await response.json();
          const errorMsg = errorData.detail || 'Failed to create Draft Order';
          setError(errorMsg);
          setCreating(false);
          throw new Error(errorMsg);
        }

        const data: DraftOrderApiResponse = await response.json();
        setCreating(false);
        setError(null);
        return data;
      } catch (err) {
        // If error was already set above, rethrow
        if (err instanceof Error) {
          setCreating(false);
          throw err;
        }

        // Network error
        const errorMsg = 'Network error';
        setError(errorMsg);
        setCreating(false);
        throw new Error(errorMsg);
      }
    },
    [apiUrl, apiKey]
  );

  return {
    createDraftOrder,
    creating,
    error,
  };
}
