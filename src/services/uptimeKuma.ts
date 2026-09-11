const HEARTBEAT_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export function startUptimeKumaHeartbeat(pushUrl?: string): () => void {
  if (!pushUrl) {
    console.log('ℹ️ Heartbeat do Uptime Kuma não configurado.');
    return () => {};
  }

  let stopped = false;

  const sendHeartbeat = async (): Promise<void> => {
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
