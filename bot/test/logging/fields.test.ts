import { describe, expect, it } from 'vitest';
import { errorLogFields } from '../../src/logging/fields';

describe('errorLogFields', () => {
    it('returns err for a plain Error', () => {
        const error = new Error('something failed');
        expect(errorLogFields(error)).toEqual({ err: error });
    });

    it('returns structured fields for an Axios-like error', () => {
        const error = Object.assign(new Error('Request failed with status 503'), {
            isAxiosError: true,
            code: 'ECONNREFUSED',
            response: { status: 503 },
        });
        expect(errorLogFields(error)).toEqual({
            errorType: 'AxiosError',
            errorMessage: 'Request failed with status 503',
            errorCode: 'ECONNREFUSED',
            statusCode: 503,
        });
    });

    it('falls back to status on the error itself when response is absent', () => {
        const error = Object.assign(new Error('timeout'), {
            isAxiosError: true,
            code: 'ECONNABORTED',
            status: 408,
        });
        expect(errorLogFields(error)).toMatchObject({
            errorType: 'AxiosError',
            statusCode: 408,
        });
    });

    it('returns errorType and message for non-Error values', () => {
        expect(errorLogFields('oops')).toEqual({
            errorType: 'string',
            errorMessage: 'oops',
        });
    });

    it('returns errorType and message for numeric errors', () => {
        expect(errorLogFields(42)).toEqual({
            errorType: 'number',
            errorMessage: '42',
        });
    });
});
