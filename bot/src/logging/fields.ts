type InteractionLocation = {
    guildId: string | null;
    channelId: string | null;
};

type AxiosErrorLike = Error & {
    isAxiosError?: boolean;
    code?: string;
    status?: number;
    response?: {
        status?: number;
    };
};

function isAxiosErrorLike(error: unknown): error is AxiosErrorLike {
    return Boolean(
        error &&
        typeof error === 'object' &&
        (error as Partial<AxiosErrorLike>).isAxiosError,
    );
}

export function interactionLocation(interaction: InteractionLocation) {
    return {
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId ?? undefined,
    };
}

export function errorLogFields(error: unknown): Record<string, unknown> {
    if (isAxiosErrorLike(error)) {
        return {
            errorType: 'AxiosError',
            errorMessage: error.message,
            errorCode: error.code,
            statusCode: error.response?.status ?? error.status,
        };
    }

    if (error instanceof Error) {
        return { err: error };
    }

    return {
        errorType: typeof error,
        errorMessage: String(error),
    };
}

export function elapsedMs(startedAt: number): number {
    return Date.now() - startedAt;
}
