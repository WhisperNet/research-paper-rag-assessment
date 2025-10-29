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
