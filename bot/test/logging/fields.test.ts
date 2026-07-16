import { describe, expect, it } from 'vitest';
import { errorLogFields } from '../../src/logging/fields';

describe('errorLogFields', () => {
    it('returns err for a plain Error', () => {
        const error = new Error('something failed');
        expect(errorLogFields(error)).toEqual({
            err: error,
            errorType: 'Error',
            errorMessage: 'something failed',
            errorCode: undefined,
            statusCode: undefined,
        });
    });

    it('returns structured fields for an HTTP response error', () => {
        const error = Object.assign(
            new Error('Request failed with status 503'),
            {
                name: 'HttpResponseError',
                statusCode: 503,
            },
        );
        expect(errorLogFields(error)).toEqual({
            err: error,
            errorType: 'HttpResponseError',
            errorMessage: 'Request failed with status 503',
            errorCode: undefined,
            statusCode: 503,
        });
    });

    it('extracts a network error code from the error cause', () => {
        const cause = Object.assign(new Error('connection refused'), {
            code: 'ECONNREFUSED',
        });
        const error = new TypeError('fetch failed', { cause });

        expect(errorLogFields(error)).toEqual({
            err: error,
            errorType: 'TypeError',
            errorMessage: 'fetch failed',
            errorCode: 'ECONNREFUSED',
            statusCode: undefined,
        });
    });

    it('extracts a network error code from the error itself', () => {
        const error = Object.assign(new TypeError('fetch failed'), {
            code: 'ECONNRESET',
        });

        expect(errorLogFields(error)).toMatchObject({
            errorType: 'TypeError',
            errorCode: 'ECONNRESET',
        });
    });

    it('ignores non-string error codes', () => {
        const error = new TypeError('fetch failed', {
            cause: { code: 500 },
        });

        expect(errorLogFields(error)).toMatchObject({
            errorType: 'TypeError',
            errorCode: undefined,
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
