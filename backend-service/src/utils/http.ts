export function ok(res: any, data: unknown, meta?: unknown) {
  res.json({ success: true, data, ...(meta ? { meta } : {}) });
}
