import { isMockApiEnabled } from '../utils/apiConfig';
import * as realClient from './apiClient';
import { autocompleteCache, startAutocompleteCache } from './autocompleteCache';
import { loadMockClient } from './mockApiLoader';

const useMock = isMockApiEnabled();

export const api = useMock
    ? loadMockClient()
    : {
          ...realClient,
          getLifterAutocomplete: (query: string, limit = 10) =>
              autocompleteCache.getLifterAutocomplete(
                  query,
                  limit,
                  realClient.getLifterAutocomplete,
              ),
          getMeetAutocomplete: (query: string, limit = 10) =>
              autocompleteCache.getMeetAutocomplete(
                  query,
                  limit,
                  realClient.getMeetAutocomplete,
              ),
      };

export function startApiDataRefresh(): void {
    if (!useMock) startAutocompleteCache();
}
