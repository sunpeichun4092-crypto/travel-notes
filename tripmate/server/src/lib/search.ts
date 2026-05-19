// =============================================================================
// Web search abstraction. Tries SerpAPI first, falls back to Bing if either
// key is set. Returns a slim {title, url, snippet} list.
// =============================================================================
import { env } from './env.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string, n = 6): Promise<SearchResult[]> {
  if (env.SERPAPI_KEY) return serpapi(query, n);
  if (env.BING_SEARCH_KEY) return bing(query, n);
  return []; // graceful empty — caller will note absence in the prompt
}

async function serpapi(query: string, n: number): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${n}&api_key=${env.SERPAPI_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = (await r.json()) as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (j.organic_results ?? []).slice(0, n).map((o) => ({
    title: o.title ?? '',
    url: o.link ?? '',
    snippet: o.snippet ?? '',
  })).filter((x) => x.url);
}

async function bing(query: string, n: number): Promise<SearchResult[]> {
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${n}`;
  const r = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': env.BING_SEARCH_KEY! },
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } };
  return (j.webPages?.value ?? []).slice(0, n).map((o) => ({
    title: o.name ?? '',
    url: o.url ?? '',
    snippet: o.snippet ?? '',
  })).filter((x) => x.url);
}
