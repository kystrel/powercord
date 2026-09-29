import { isMockApiEnabled } from '../utils/apiConfig';
import { config } from '../utils/config';
import { loadMockClient } from './mockApiLoader';
import { SqliteClient } from './sqliteClient';

const useMock = isMockApiEnabled();
let client: SqliteClient | undefined;

function localClient(): SqliteClient {
    if (!client) throw new Error('SQLite data has not been initialized');
    return client;
}

export const api = useMock
    ? loadMockClient()
    : {
          getLifter: async (name: string) => localClient().getLifter(name),
          getMeet: async (name: string) => localClient().getMeet(name),
          getTopLifters: async () => localClient().getTopLifters(),
          getLifterAutocomplete: async (query: string, limit = 10) =>
              localClient().getLifterAutocomplete(query, limit),
          getMeetAutocomplete: async (query: string, limit = 10) =>
              localClient().getMeetAutocomplete(query, limit),
      };

export function initializeApiData(): void {
    if (useMock) return;
    if (!config.SQLITE_PATH) throw new Error('SQLITE_PATH is required');
    client = new SqliteClient(config.SQLITE_PATH);
}

export function getDataStatus() {
    return useMock ? undefined : localClient().status;
}
