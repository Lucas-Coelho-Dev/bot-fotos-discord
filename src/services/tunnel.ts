import { startTunnel } from 'untun';
import { config } from '../config.js';

let activeTunnelUrl: string = '';
let tunnelInstance: any = null;

export async function initPublicUrl(): Promise<string> {
  // Se o usuário configurou uma URL própria fixa no .env
  if (config.publicUrl) {
    activeTunnelUrl = config.publicUrl;
    console.log(`🌐 Usando URL configurada: ${activeTunnelUrl}`);
    return activeTunnelUrl;
  }

  // Se não tem URL fixa, inicia automaticamente o Cloudflare Quick Tunnel (HTTPS grátis)
  console.log('🚀 Iniciando túnel Cloudflare gratuito com HTTPS automático...');
  try {
    tunnelInstance = await startTunnel({
      port: config.port,
      acceptCloudflareNotice: true,
    });

    const url = await tunnelInstance.getURL();
    activeTunnelUrl = url ? url.replace(/\/$/, '') : `http://localhost:${config.port}`;
    console.log(`\n======================================================`);
    console.log(`✨ TÚNEL CLOUDFLARE ATIVO (HTTPS GRÁTIS):`);
    console.log(`👉 ${activeTunnelUrl}`);
    console.log(`======================================================\n`);
    return activeTunnelUrl;
  } catch (err) {
    console.error('❌ Falha ao iniciar túnel Cloudflare:', err);
    // Fallback para localhost caso dê erro
    activeTunnelUrl = `http://localhost:${config.port}`;
    console.warn(`⚠️ Usando fallback local: ${activeTunnelUrl}`);
    return activeTunnelUrl;
  }
}

export function getPublicUrl(): string {
  if (!activeTunnelUrl) {
    return config.publicUrl || `http://localhost:${config.port}`;
  }
  return activeTunnelUrl;
}

export async function closeTunnel(): Promise<void> {
  if (tunnelInstance && typeof tunnelInstance.close === 'function') {
    await tunnelInstance.close();
  }
}
