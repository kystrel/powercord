type InteractionLocation = {
    guildId: string | null;
    channelId: string | null;
};

type ErrorWithContext = Error & {
    code?: unknown;
    statusCode?: unknown;
    cause?: unknown;
};

function getErrorCode(error: ErrorWithContext): string | undefined {
    if (typeof error.code === 'string') return error.code;

    if (error.cause && typeof error.cause === 'object') {
        const causeCode = (error.cause as { code?: unknown }).code;
        if (typeof causeCode === 'string') return causeCode;
    }

    return undefined;
}

export function interactionLocation(interaction: InteractionLocation) {
    return {
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId ?? undefined,
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
