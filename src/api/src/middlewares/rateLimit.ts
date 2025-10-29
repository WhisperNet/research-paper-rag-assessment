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
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
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
