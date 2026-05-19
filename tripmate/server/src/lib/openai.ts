import OpenAI from 'openai';
import { env } from './env.js';

let _client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  if (!_client) _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
}
