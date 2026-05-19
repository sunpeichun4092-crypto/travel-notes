// Web search grounding — SerpAPI primary, Bing fallback. Returns up to N
// results. If neither key is configured, returns []; the GPT prompt knows to
// proceed cautiously without citations in that case.
export interface SearchResult { title: string; url: string; snippet: string }

export async function webSearch(query: string, n = 5): Promise<SearchResult[]> {
  if (process.env.SERPAPI_API_KEY) {
    const r = await fetch(
      `https://serpapi.com/search.json?engine=google&hl=zh-cn&q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_API_KEY}`,
    );
    if (r.ok) {
      const j = await r.json() as any;
      return (j.organic_results ?? []).slice(0, n).map((x: any) => ({
        title: x.title ?? '', url: x.link ?? '', snippet: x.snippet ?? '',
      })).filter((r: SearchResult) => r.url);
    }
  }
  if (process.env.BING_SEARCH_KEY) {
    const r = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${n}&mkt=zh-CN`,
      { headers: { 'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_KEY } },
    );
    if (r.ok) {
      const j = await r.json() as any;
      return (j.webPages?.value ?? []).slice(0, n).map((x: any) => ({
        title: x.name ?? '', url: x.url ?? '', snippet: x.snippet ?? '',
      })).filter((r: SearchResult) => r.url);
    }
  }
  return [];
}
