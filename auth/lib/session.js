import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'wikinb_kcis_session';

function secretKey() {
  const raw = process.env.SESSION_SECRET || 'dev-only-insecure-secret';
  return new TextEncoder().encode(raw);
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function createSessionToken(user) {
  return new SignJWT({
    sub: user.email,
    email: user.email,
    name: user.name,
    role: user.role,
    picture: user.picture || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      email: String(payload.email || payload.sub || ''),
      name: String(payload.name || ''),
      role: String(payload.role || 'student'),
      picture: String(payload.picture || ''),
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions({ maxAgeMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  // Pages（https）→ 主機 Auth（https tunnel）需 SameSite=None; Secure
  const authHttps = String(process.env.AUTH_BASE_URL || '').startsWith('https');
  const crossSite =
    String(process.env.COOKIE_SAMESITE || '').toLowerCase() === 'none' || authHttps;
  return {
    httpOnly: true,
    sameSite: crossSite ? 'none' : 'lax',
    secure: crossSite || authHttps,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}
