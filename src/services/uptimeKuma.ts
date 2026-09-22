const HEARTBEAT_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export function startUptimeKumaHeartbeat(
  pushUrl?: string,
  isServiceReady: () => boolean = () => true
): () => void {
  if (!pushUrl) {
    console.log('ℹ️ Heartbeat do Uptime Kuma não configurado.');
    return () => {};
  }

  let stopped = false;
  let lastReadiness: boolean | undefined;

  const sendHeartbeat = async (): Promise<void> => {
    let ready = false;
    try {
      ready = isServiceReady();
    } catch (err) {
      console.error('❌ Falha ao verificar a prontidão do bot:', err);
    }

    if (!ready) {
      if (lastReadiness !== false) {
        console.warn('⏳ Heartbeat aguardando Discord e túnel ficarem prontos.');
      }
      lastReadiness = false;
      return;
    }

    if (lastReadiness === false) {
      console.log('✅ Discord e túnel prontos; retomando heartbeats.');
    }
    lastReadiness = true;

    try {
      const response = await fetch(pushUrl, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      if (!stopped) {
        console.error('❌ Erro ao enviar heartbeat para o Uptime Kuma:', err);
      }
    }
  };

  void sendHeartbeat();
  const timer = setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);

  console.log('💓 Heartbeat do Uptime Kuma ativado a cada 60 segundos.');

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
