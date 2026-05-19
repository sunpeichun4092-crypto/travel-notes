// Thin wrapper around fetch — auto-injects Supabase access token + JSON.
import { supabase } from '../lib/supabase';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const auth = await authHeader();
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const msg = (json as { error?: string } | null)?.error ?? r.statusText;
    throw new Error(msg);
  }
  return json as T;
}

export const api = {
  get:    <T = unknown>(p: string)             => request<T>('GET', p),
  post:   <T = unknown>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch:  <T = unknown>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  delete: <T = unknown>(p: string)             => request<T>('DELETE', p),
};
