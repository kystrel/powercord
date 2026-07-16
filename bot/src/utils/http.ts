export class HttpResponseError extends Error {
    constructor(readonly statusCode: number) {
        super(`HTTP request failed with status ${statusCode}`);
        this.name = 'HttpResponseError';
    }
}

export async function discardResponseBody(response: Response): Promise<void> {
    try {
        await response.body?.cancel();
    } catch {
        // Cleanup is best effort and must not replace the request outcome.
    }
}

export async function fetchOk(
    input: string | URL,
    init?: RequestInit,
): Promise<Response> {
    const response = await fetch(input, init);

    if (!response.ok) {
        await discardResponseBody(response);
        throw new HttpResponseError(response.status);
    }

    return response;
}
