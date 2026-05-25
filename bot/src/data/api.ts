import { config } from '../utils/config';
import * as realClient from './apiClient';
import { autocompleteCache, startAutocompleteCache } from './autocompleteCache';
import * as mockClient from './mockClient';

const useMock = config.ENABLE_MOCK_API || !config.API_BASE_URL;

export const api = useMock
    ? mockClient
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
