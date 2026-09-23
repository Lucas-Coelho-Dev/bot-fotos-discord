import { startTunnel, Tunnel } from 'untun';
import { config } from '../config.js';

let activeTunnelUrl: string = '';
let tunnelInstance: Tunnel | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let monitorTimer: NodeJS.Timeout | null = null;
let starting = false;
let shuttingDown = false;
let attempt = 0;
let consecutiveProbeFailures = 0;

const TUNNEL_START_TIMEOUT_MS = 20_000;
const TUNNEL_RETRY_INTERVAL_MS = 60_000;
const TUNNEL_MONITOR_INTERVAL_MS = 30_000;
const TUNNEL_PROBE_TIMEOUT_MS = 10_000;
const TUNNEL_PROBE_FAILURE_LIMIT = 2;
const TUNNEL_PROBE_PATH = '/upload/__tunnel_probe__';
const PUBLIC_URL_WAIT_TIMEOUT_MS = 120_000;
const PUBLIC_URL_POLL_INTERVAL_MS = 250;

function localFallbackUrl(): string {
  return `http://localhost:${config.port}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`tempo limite de ${timeoutMs / 1000}s excedido`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function scheduleRetry(): void {
  if (shuttingDown || retryTimer || activeTunnelUrl) return;

  console.warn('🔄 Nova tentativa do túnel Cloudflare em 60 segundos.');
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void startTunnelAttempt();
  }, TUNNEL_RETRY_INTERVAL_MS);
}

function stopTunnelMonitor(): void {
  if (monitorTimer) {
    clearTimeout(monitorTimer);
    monitorTimer = null;
  }

  consecutiveProbeFailures = 0;
}

function scheduleTunnelMonitor(): void {
  if (shuttingDown || monitorTimer || !activeTunnelUrl || !tunnelInstance) return;

  monitorTimer = setTimeout(() => {
    monitorTimer = null;
    void probeActiveTunnel();
  }, TUNNEL_MONITOR_INTERVAL_MS);
}

async function recycleTunnel(): Promise<void> {
  stopTunnelMonitor();

  const staleTunnel = tunnelInstance;
  tunnelInstance = null;
  activeTunnelUrl = '';

  if (staleTunnel) {
    await staleTunnel.close().catch(() => undefined);
  }

  if (!shuttingDown) {
    await startTunnelAttempt();
  }
}

async function probeActiveTunnel(): Promise<void> {
  if (shuttingDown || !activeTunnelUrl || !tunnelInstance) return;

  const checkedUrl = activeTunnelUrl;

  try {
    const response = await fetch(`${checkedUrl}${TUNNEL_PROBE_PATH}`, {
      method: 'GET',
      signal: AbortSignal.timeout(TUNNEL_PROBE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (activeTunnelUrl !== checkedUrl) return;

    if (consecutiveProbeFailures > 0) {
      console.log('✅ Túnel Cloudflare voltou a responder normalmente.');
    }
    consecutiveProbeFailures = 0;
  } catch (err) {
    if (activeTunnelUrl !== checkedUrl || shuttingDown) return;

    consecutiveProbeFailures += 1;
    console.warn(
      `⚠️ Túnel Cloudflare não respondeu ` +
      `(${consecutiveProbeFailures}/${TUNNEL_PROBE_FAILURE_LIMIT}):`,
      err
    );

    if (consecutiveProbeFailures >= TUNNEL_PROBE_FAILURE_LIMIT) {
      console.warn('♻️ Túnel Cloudflare inválido; iniciando autorrecuperação.');
      await recycleTunnel();
      return;
    }
  }

  if (activeTunnelUrl === checkedUrl) {
    scheduleTunnelMonitor();
  }
}

async function startTunnelAttempt(): Promise<void> {
  if (starting || shuttingDown || activeTunnelUrl) return;

  starting = true;
  attempt += 1;
  console.log(`🚀 Iniciando túnel Cloudflare (tentativa ${attempt})...`);

  try {
    const candidate = await withTimeout(
      startTunnel({
        port: config.port,
        acceptCloudflareNotice: true,
      }),
      TUNNEL_START_TIMEOUT_MS
    );

    if (!candidate) {
      throw new Error('o processo do túnel não foi criado');
    }

    tunnelInstance = candidate;
    const url = await withTimeout(candidate.getURL(), TUNNEL_START_TIMEOUT_MS);

    if (shuttingDown) {
      await candidate.close();
      tunnelInstance = null;
      return;
    }

    activeTunnelUrl = url.replace(/\/$/, '');
    consecutiveProbeFailures = 0;
    console.log('\n======================================================');
    console.log('✨ TÚNEL CLOUDFLARE ATIVO (HTTPS GRÁTIS):');
    console.log(`👉 ${activeTunnelUrl}`);
    console.log('======================================================\n');
    scheduleTunnelMonitor();
  } catch (err) {
    console.error('❌ Falha ao iniciar túnel Cloudflare:', err);

    const failedTunnel = tunnelInstance;
    tunnelInstance = null;
    if (failedTunnel) {
      await failedTunnel.close().catch(() => undefined);
    }

    console.warn(`⚠️ O servidor local continua disponível em ${localFallbackUrl()}.`);
    scheduleRetry();
  } finally {
    starting = false;
  }
}

export function initPublicUrl(): void {
  if (config.publicUrl) {
    activeTunnelUrl = config.publicUrl;
    console.log(`🌐 Usando URL configurada: ${activeTunnelUrl}`);
    return;
  }

  void startTunnelAttempt();
}

export function getPublicUrl(): string {
  const publicUrl = activeTunnelUrl || config.publicUrl;

  if (!publicUrl) {
    throw new Error('A URL pública ainda não está disponível. Aguarde alguns instantes e tente novamente.');
  }

  return publicUrl;
}

export async function waitForPublicUrl(
  timeoutMs: number = PUBLIC_URL_WAIT_TIMEOUT_MS
): Promise<string> {
  const currentUrl = activeTunnelUrl || config.publicUrl;
  if (currentUrl) return currentUrl;

  return new Promise<string>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const publicUrl = activeTunnelUrl || config.publicUrl;

      if (publicUrl) {
        clearInterval(timer);
        resolve(publicUrl);
        return;
      }

      if (shuttingDown || Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(
          new Error('O link público está temporariamente indisponível. Aguarde um minuto e tente novamente.')
        );
      }
    }, PUBLIC_URL_POLL_INTERVAL_MS);
  });
}

export function isPublicUrlReady(): boolean {
  return Boolean(activeTunnelUrl);
}

export async function closeTunnel(): Promise<void> {
  shuttingDown = true;
  stopTunnelMonitor();

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  const currentTunnel = tunnelInstance;
  tunnelInstance = null;
  activeTunnelUrl = '';

  if (currentTunnel) {
    await currentTunnel.close().catch(() => undefined);
  }
}
