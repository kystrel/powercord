type InteractionContext = {
    guildId: string | null;
    channelId: string | null;
    user: { id: string };
};

type ErrorWithContext = Error & {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    cause?: unknown;
};

const networkErrorCodes = new Set([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
]);

function getErrorCode(error: ErrorWithContext): string | undefined {
    if (typeof error.code === 'string') return error.code;

    if (error.cause && typeof error.cause === 'object') {
        const causeCode = (error.cause as { code?: unknown }).code;
        if (typeof causeCode === 'string') return causeCode;
    }

    return undefined;
}

export function interactionContext(interaction: InteractionContext) {
    return {
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId ?? undefined,
        userId: interaction.user.id,
    };
}

export function errorLogSummary(error: unknown) {
    if (!(error instanceof Error)) {
        return { errorType: typeof error };
    }

    const contextualError = error as ErrorWithContext;
    const { code, status, statusCode = status } = contextualError;
    const networkCode = getErrorCode(contextualError);
    const knownNetworkCode =
        networkCode && networkErrorCodes.has(networkCode)
            ? networkCode
            : undefined;
    return {
        errorType: error.constructor.name,
        errorCode: typeof code === 'number' ? code : knownNetworkCode,
        statusCode: typeof statusCode === 'number' ? statusCode : undefined,
    };
}

export function errorLogFields(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        const contextualError = error as ErrorWithContext;
        return {
            err: error,
            errorType: error.name,
            errorMessage: error.message,
            errorCode: getErrorCode(contextualError),
            statusCode:
                typeof contextualError.statusCode === 'number'
                    ? contextualError.statusCode
                    : undefined,
        };
    }

    return {
        errorType: typeof error,
        errorMessage: String(error),
    };
}

export function elapsedMs(startedAt: number): number {
    return Date.now() - startedAt;
}
