import { Tool } from "@langchain/core/tools";

export class TavilySearchResults extends Tool {
    name = "tavily_search_results_json";
    description = "A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.";

    private apiKey: string;

    constructor(fields?: { apiKey?: string }) {
        super();
        this.apiKey = fields?.apiKey || process.env.TAVILY_API_KEY || "";
        if (!this.apiKey) {
            throw new Error("Tavily API key not found");
        }
    }

    async _call(input: string): Promise<string> {
        try {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query: input,
                    search_depth: "advanced",
                    include_answer: true,
                    include_images: false,
                    include_raw_content: true,
                    max_results: 5,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}: ${json.error || JSON.stringify(json)}`);
            }

            // Format results
            const results = json.results.map((r: any) => ({
                title: r.title,
                url: r.url,
                content: r.content
            }));

            return JSON.stringify(results);

        } catch (error: any) {
            return `Error performing search: ${error.message}`;
        }
    }
}

export const tavilyTool = new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
});
