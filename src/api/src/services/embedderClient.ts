// src/api/src/services/embedderClient.ts
import { loadEnv } from '../config/env';

export async function callExtract(
  file: Buffer,
  filename: string,
  mimetype: string
): Promise<any> {
  const base = process.env.EMBEDDER_URL || 'http://localhost:9100';
  const form = new FormData();
  form.append('file', new Blob([file], { type: mimetype }), filename);
  const resp = await fetch(`${base}/extract`, {
    method: 'POST',
    body: form as any,
  });
  if (!resp.ok) {
    throw new Error(`extract failed: ${resp.status}`);
  }
  return await resp.json();
}

export async function callEmbed(
  texts: string[],
  model?: string
): Promise<{ vectors: number[][]; dim: number; model: string }> {
  const base = process.env.EMBEDDER_URL || 'http://localhost:9100';
  const body: any = { texts };
  if (model) body.model = model;
  const resp = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`embed failed: ${resp.status} ${text}`);
  }
  return await resp.json();
}
