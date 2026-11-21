// Bloqueio do Cockpit com Windows Hello (digital/rosto/PIN) via WebAuthn.
// A biometria nunca sai do computador: o Windows confirma a identidade e o navegador
// devolve uma assinatura, que é verificada aqui com a chave pública cadastrada.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { HttpError } from './azure';

const FILE = resolve(process.cwd(), 'data', 'auth.json');
const RP_ID = 'localhost';
const RP_NAME = 'Cockpit';
const COOKIE = 'cockpit_session';
export const SESSION_HOURS = 8;

interface StoredCredential {
  id: string;
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  createdAt: string;
}

interface AuthFile {
  userId: string; // base64url
  credentials: StoredCredential[];
}

// ---------- Armazenamento ----------

async function readAuth(): Promise<AuthFile | null> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8')) as AuthFile;
    return parsed.credentials?.length ? parsed : null;
  } catch {
    return null;
  }
}

async function writeAuth(data: AuthFile) {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Sessões (em memória: reiniciar o Cockpit bloqueia de novo) ----------

const sessions = new Map<string, number>(); // token -> expira em (ms)
let pendingChallenge: { value: string; kind: 'register' | 'login'; expires: number } | null = null;

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function sessionOf(req: Request): number | null {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  for (const [t, exp] of sessions) {
    const a = Buffer.from(t);
    const b = Buffer.from(token);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      if (exp > Date.now()) return exp;
      sessions.delete(t);
      return null;
    }
  }
  return null;
}

function startSession(res: Response) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  sessions.set(token, expires);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`,
  );
  return expires;
}

/** Aceita só páginas do próprio computador (localhost em qualquer porta) */
function expectedOrigin(req: Request) {
  const origin = String(req.headers.origin ?? '');
  if (!/^http:\/\/localhost:\d+$/.test(origin)) {
    throw new HttpError('Origem não permitida. Abra o Cockpit por http://localhost.', 403);
  }
  return origin;
}

function takeChallenge(kind: 'register' | 'login') {
  const c = pendingChallenge;
  pendingChallenge = null;
  if (!c || c.kind !== kind || c.expires < Date.now()) {
    throw new HttpError('A verificação expirou. Tente de novo.', 400);
  }
  return c.value;
}

// ---------- Rotas ----------

export async function authStatus(req: Request) {
  const exp = sessionOf(req);
  return {
    registered: !!(await readAuth()),
    authenticated: !!exp,
    expiresAt: exp ? new Date(exp).toISOString() : null,
    sessionHours: SESSION_HOURS,
  };
}

export async function registerOptions(req: Request) {
  const auth = await readAuth();
  // Depois do primeiro cadastro, só quem está desbloqueado pode cadastrar outra digital/dispositivo
  if (auth && !sessionOf(req)) throw new HttpError('Desbloqueie o Cockpit antes de cadastrar outro acesso.', 401);
  const userId = auth?.userId ?? randomBytes(16).toString('base64url');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: 'cockpit',
    userDisplayName: 'Cockpit · QA Analytics',
    userID: Buffer.from(userId, 'base64url'),
    attestationType: 'none',
    excludeCredentials: (auth?.credentials ?? []).map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Windows Hello deste computador
      userVerification: 'required', // exige digital/rosto/PIN
      residentKey: 'preferred',
    },
  });
  pendingChallenge = { value: options.challenge, kind: 'register', expires: Date.now() + 5 * 60 * 1000 };
  return { options, userId };
}

export async function registerVerify(req: Request, res: Response) {
  const origin = expectedOrigin(req);
  const challenge = takeChallenge('register');
  const auth = await readAuth();
  if (auth && !sessionOf(req)) throw new HttpError('Desbloqueie o Cockpit antes de cadastrar outro acesso.', 401);
  const body = req.body as { response: RegistrationResponseJSON; userId: string };

  const result = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!result.verified) throw new HttpError('Não foi possível confirmar o cadastro.', 400);

  const { credential } = result.registrationInfo;
  const next: AuthFile = {
    userId: auth?.userId ?? String(body.userId),
    credentials: [
      ...(auth?.credentials ?? []),
      {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  await writeAuth(next);
  const expires = startSession(res);
  return { ok: true, expiresAt: new Date(expires).toISOString() };
}

export async function loginOptions() {
  const auth = await readAuth();
  if (!auth) throw new HttpError('Nenhuma digital cadastrada ainda.', 400);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: auth.credentials.map((c) => ({ id: c.id, transports: c.transports })),
    userVerification: 'required',
  });
  pendingChallenge = { value: options.challenge, kind: 'login', expires: Date.now() + 5 * 60 * 1000 };
  return options;
}

export async function loginVerify(req: Request, res: Response) {
  const origin = expectedOrigin(req);
  const challenge = takeChallenge('login');
  const auth = await readAuth();
  if (!auth) throw new HttpError('Nenhuma digital cadastrada ainda.', 400);
  const response = req.body as AuthenticationResponseJSON;
  const stored = auth.credentials.find((c) => c.id === response.id);
  if (!stored) throw new HttpError('Esta credencial não está cadastrada no Cockpit.', 401);

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    credential: {
      id: stored.id,
      publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
      counter: stored.counter,
      // tipos de transporte vêm do próprio navegador no cadastro
      transports: stored.transports as never,
    },
  });
  if (!result.verified) throw new HttpError('Digital não confirmada.', 401);

  stored.counter = result.authenticationInfo.newCounter;
  await writeAuth(auth);
  const expires = startSession(res);
  return { ok: true, expiresAt: new Date(expires).toISOString() };
}

export function logout(req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  return { ok: true };
}

/** Bloqueia todas as rotas /api (menos as de autenticação) sem sessão válida */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api') || req.path.startsWith('/api/auth/')) return next();
  if (sessionOf(req)) return next();
  res.status(401).json({ error: 'Cockpit bloqueado. Desbloqueie com a sua digital.', locked: true });
}
