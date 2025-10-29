import { randomUUID } from 'crypto';

export function requestId() {
  return (req: any, res: any, next: any) => {
    const headerId = req.header?.('x-request-id') || req.headers['x-request-id'];
    const id = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
    (req as any).id = id;
    res.setHeader('x-request-id', id);
    next();
  };
}


