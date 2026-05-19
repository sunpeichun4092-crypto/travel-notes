// Tiny wrapper around the OpenAI Chat Completions endpoint. We avoid the
// official `openai` SDK so the Next.js bundle stays small (the SDK pulls
// in form-data + axios + a few hundred KB of polyfills).
export interface ChatMessage { role: 'system' | 'user'; content: string | any[] }

export async function chatJSON({
  model, messages, temperature = 0.6,
}: { model: string; messages: ChatMessage[]; temperature?: number }): Promise<any> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model, messages, temperature,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`openai ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content);
}
