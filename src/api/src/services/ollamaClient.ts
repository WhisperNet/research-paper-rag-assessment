import { loadEnv } from '../config/env';

export async function ollamaTags(): Promise<any> {
  const env = loadEnv();
  const resp = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
  if (!resp.ok) throw new Error(`Ollama status ${resp.status}`);
  return resp.json();
}

export async function pingOllama(skip = false): Promise<boolean> {
  if (skip) return true;
  await ollamaTags();
  return true;
}

export async function generateAnswer(prompt: string): Promise<string> {
  const env = loadEnv();
  const model = 'llama3';
  const resp = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!resp.ok) throw new Error(`Ollama generate status ${resp.status}`);
  const data = await resp.json();
  return data.response || '';
}
