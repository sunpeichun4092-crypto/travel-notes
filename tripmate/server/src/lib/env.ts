import 'dotenv/config';
import { z } from 'zod';

const Schema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.string().default('development'),
  ALLOWED_ORIGINS: z.string().default('*'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_TEXT: z.string().default('gpt-4o'),
  OPENAI_MODEL_VISION: z.string().default('gpt-4o'),
  SERPAPI_KEY: z.string().optional(),
  BING_SEARCH_KEY: z.string().optional(),
});

export const env = Schema.parse(process.env);
