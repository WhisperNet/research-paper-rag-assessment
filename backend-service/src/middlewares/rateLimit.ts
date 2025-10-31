type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit({
  windowMs,
  max,
}: {
  windowMs: number;
  max: number;
}) {
  return (req: any, res: any, next: any) => {
    // Determine client IP in a safe order:
    // 1) X-Forwarded-For (only trustworthy when behind a trusted proxy)
    // 2) req.ip (Express-populated; respects trust proxy when configured)
    // 3) req.socket.remoteAddress (preferred over deprecated req.connection)
    // Note: We avoid a fixed 'unknown' fallback to prevent a shared bucket.
    const xffHeader = (req.headers?.['x-forwarded-for'] ??
      req.headers?.['X-Forwarded-For']) as string | string[] | undefined;
    let ipFromXff = '';
    if (Array.isArray(xffHeader)) {
      ipFromXff = xffHeader[0] ?? '';
    } else if (typeof xffHeader === 'string') {
      // XFF may be a comma-separated list; take the first hop
      ipFromXff = xffHeader.split(',')[0]?.trim() ?? '';
    }
    // Prefer XFF only when your deployment is behind a trusted proxy. Otherwise, this header can be spoofed.
    const ip = ipFromXff || req.ip || req.socket?.remoteAddress || '';
    const now = Date.now();
    const bucket = buckets.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(ip, bucket);
    res.setHeader('x-rate-limit-limit', String(max));
    res.setHeader(
      'x-rate-limit-remaining',
      String(Math.max(0, max - bucket.count))
    );
    res.setHeader(
      'x-rate-limit-reset',
      String(Math.floor(bucket.resetAt / 1000))
    );
    if (bucket.count > max) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
      return;
    }
    next();
  };
}
