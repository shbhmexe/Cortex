// Market-equivalent pricing per 1M tokens (even though Groq free tier is $0)
// This shows users what the research would cost at market rates
export const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
    groq: {
        "llama-3.3-70b-versatile": {
            input: 0.59,   // $/1M input tokens
            output: 0.79,  // $/1M output tokens
        },
        "llama-3.1-8b-instant": {
            input: 0.05,   // $/1M input tokens
            output: 0.08,  // $/1M output tokens
        },
        "gemma2-9b-it": {
            input: 0.20,   // $/1M input tokens
            output: 0.20,  // $/1M output tokens
        },
    },
};

export const TAVILY_COST_PER_SEARCH = 0.005;

// Estimate token count from text (~4 chars per token for English)
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    searchCount: number = 0
): number {
    let modelCost = 0;

    // Find pricing for this model
    const modelPricing = Object.values(PRICING).flatMap(provider =>
        Object.entries(provider)
    ).find(([name]) => model.includes(name));

    if (modelPricing) {
        const [, prices] = modelPricing;
        // Price is per 1M tokens
        modelCost = (inputTokens * prices.input / 1_000_000) + (outputTokens * prices.output / 1_000_000);
    }

    const searchCost = searchCount * TAVILY_COST_PER_SEARCH;

    return parseFloat((modelCost + searchCost).toFixed(4));
}
