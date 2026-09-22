import { config, validateConfig } from './config.js';
import { initPublicUrl, closeTunnel, isPublicUrlReady } from './services/tunnel.js';
import { discordClient, initBot } from './bot.js';
import { createServer } from './server.js';
import { startUptimeKumaHeartbeat } from './services/uptimeKuma.js';

async function main() {
  let stopUptimeKumaHeartbeat = () => {};

  console.log('======================================================');
  console.log('       DISCORD PHOTO BOT - INICIANDO SISTEMA          ');
  console.log('======================================================\n');

  // Valida variáveis de ambiente
  validateConfig();

  // 1. Inicia o servidor Web Fastify
  const server = createServer(discordClient);
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`📡 Servidor Web rodando localmente em: http://localhost:${config.port}`);
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor Web:', err);
    process.exit(1);
  }

  // 2. Inicia o Cloudflare Tunnel em segundo plano. Uma falha de rede não
  // bloqueia mais a conexão do bot com o Discord.
  initPublicUrl();

  // 3. Conecta o Bot do Discord (se o token estiver configurado)
  if (config.discordToken) {
    console.log('🤖 Conectando ao Discord...');
    await initBot();
    stopUptimeKumaHeartbeat = startUptimeKumaHeartbeat(
      config.uptimeKumaPushUrl,
      () => discordClient.isReady() && isPublicUrlReady()
    );
  } else {
    console.log('\n👉 Para conectar o bot ao Discord:');
    console.log('   Preencha o arquivo .env com seu DISCORD_TOKEN, DISCORD_CLIENT_ID e DISCORD_GUILD_ID.');
  }

  // Graceful shutdown
  const handleShutdown = async () => {
    console.log('\n🛑 Encerrando aplicação com segurança...');
    stopUptimeKumaHeartbeat();
    await closeTunnel();
    await server.close();
    discordClient.destroy();
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

main().catch((err) => {
  console.error('❌ Erro fatal na inicialização:', err);
  process.exit(1);
});
