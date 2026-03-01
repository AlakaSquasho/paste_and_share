// server/src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// Resolve logs dir from runtime cwd (e.g. /app in Docker or /.../server locally)
const logDirectory = path.resolve(process.env.LOG_DIR || path.resolve(process.cwd(), 'logs'));
const logFile = path.join(logDirectory, 'access.log');
const IPINFO_API_KEY = process.env.IPINFO_API_KEY || '';
const IPINFO_BASE_URL = 'https://ipinfo.dkly.net/api/';
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type GeoCacheEntry = {
  value: string | null;
  expiresAt: number;
};

const geoCache = new Map<string, GeoCacheEntry>();

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

export const accessLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Get IP address
  const ip = normalizeIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);

  // Listen for the finish event to log the status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = formatTimestampUTC8(new Date());
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const userAgent = req.headers['user-agent'] || '-';

    void (async () => {
      const geoResult = await lookupLocation(ip);
      const locationLabel = geoResult.location ? ` (${geoResult.location})` : '';
      const geoErrorLabel = geoResult.error ? ` - geo_error=${geoResult.error}` : '';
      const logEntry = `[${timestamp}] ${ip}${locationLabel} - ${method} ${url} ${status} (${duration}ms) - ${userAgent}${geoErrorLabel}\n`;

      try {
        fs.appendFileSync(logFile, logEntry);
      } catch (err) {
        console.error('Failed to write to access log:', err);
      }
    })();
  });

  next();
};

const normalizeIp = (
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined
): string => {
  const raw =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0].trim() ||
    remoteAddress ||
    'unknown';

  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }

  const ipv4WithPort = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  return raw;
};

const lookupLocation = async (
  ip: string
): Promise<{ location: string | null; error: string | null }> => {
  if (!IPINFO_API_KEY || ip === 'unknown') {
    return { location: null, error: null };
  }

  const now = Date.now();
  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > now) {
    return { location: cached.value, error: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${IPINFO_BASE_URL}?ip=${encodeURIComponent(ip)}`, {
      headers: {
        'X-API-Key': IPINFO_API_KEY,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      cacheLocation(ip, null);
      return { location: null, error: `http_${response.status}` };
    }

    const data = (await response.json()) as {
      location?: {
        country?: { name?: string };
        region?: { name?: string };
        city?: string;
      };
    };

    const parts = [
      data.location?.country?.name,
      data.location?.region?.name,
      data.location?.city,
    ].filter(Boolean) as string[];

    const label = parts.length > 0 ? parts.join('/') : null;
    cacheLocation(ip, label);
    return { location: label, error: null };
  } catch (err) {
    cacheLocation(ip, null);
    const isAbort =
      err instanceof DOMException
        ? err.name === 'AbortError'
        : (err as { name?: string } | null)?.name === 'AbortError';
    return { location: null, error: isAbort ? 'timeout' : 'fetch_error' };
  } finally {
    clearTimeout(timeout);
  }
};

const cacheLocation = (ip: string, value: string | null) => {
  geoCache.set(ip, { value, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
};

const formatTimestampUTC8 = (date: Date): string => {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const utc8 = new Date(utcMs + 8 * 60 * 60 * 1000);

  const pad = (value: number, len: number) => String(value).padStart(len, '0');

  const y = utc8.getUTCFullYear();
  const m = pad(utc8.getUTCMonth() + 1, 2);
  const d = pad(utc8.getUTCDate(), 2);
  const hh = pad(utc8.getUTCHours(), 2);
  const mm = pad(utc8.getUTCMinutes(), 2);
  const ss = pad(utc8.getUTCSeconds(), 2);
  const ms = pad(utc8.getUTCMilliseconds(), 3);

  return `${y}-${m}-${d}_${hh}:${mm}:${ss}.${ms}`;
};
