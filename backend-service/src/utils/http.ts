export function ok(res: any, data: unknown, meta?: unknown) {
  res.json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function notImplemented(res: any, message = 'Not implemented') {
  res
    .status(501)
    .json({ success: false, error: { code: 'NOT_IMPLEMENTED', message } });
}
