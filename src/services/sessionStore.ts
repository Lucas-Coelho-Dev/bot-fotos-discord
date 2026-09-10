import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadSession {
  token: string;
  channelId: string;
  userId: string;
  guildId: string;
  createdAt: number;
  expiresAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const DURATION_24H_MS = 24 * 60 * 60 * 1000;

class SessionStore {
  private sessions: Map<string, UploadSession> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadSessions();
    // Limpeza periódica de sessões expiradas a cada 1 hora
    setInterval(() => this.cleanupExpired(), 60 * 60 * 1000).unref();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadSessions(): void {
    if (!fs.existsSync(SESSIONS_FILE)) {
      return;
    }
    try {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed: UploadSession[] = JSON.parse(data);
      const now = Date.now();
      for (const session of parsed) {
        if (session.expiresAt > now) {
          this.sessions.set(session.token, session);
        }
      }
    } catch (err) {
      console.error('Erro ao ler sessions.json:', err);
    }
  }

  private saveSessions(): void {
    try {
      const arr = Array.from(this.sessions.values());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar sessions.json:', err);
    }
  }

  public createSession(channelId: string, userId: string, guildId: string): UploadSession {
    const token = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const session: UploadSession = {
      token,
      channelId,
      userId,
      guildId,
      createdAt: now,
      expiresAt: now + DURATION_24H_MS,
    };

    this.sessions.set(token, session);
    this.saveSessions();
    return session;
  }

  public getSession(token: string): UploadSession | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    return session;
  }

  public isSessionValid(token: string): boolean {
    return this.getSession(token) !== null;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let changed = false;
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) {
      this.saveSessions();
    }
  }
}

export const sessionStore = new SessionStore();
