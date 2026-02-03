import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';

export function createRequestLogger() {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
  });

  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers['x-request-id']?.toString() ?? randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
    },
  });
}

