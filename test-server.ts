import { createServer } from './src/server.js';
import { sessionStore } from './src/services/sessionStore.js';
import { generateQrCodeBuffer } from './src/services/qrCodeService.js';
import { Client } from 'discord.js';

async function runTests() {
  console.log('🧪 Iniciando testes de validação local...\n');

  // Mock do Discord Client para testes locais sem login
  const mockClient = {
    channels: {
      fetch: async (id: string) => {
        console.log(`[Mock Discord] Buscando canal: ${id}`);
        return null; // Canal mock
      }
    }
  } as unknown as Client;

  // 1. Testa Session Store
  console.log('1️⃣ Testando SessionStore (Criação e Validação)...');
  const session = sessionStore.createSession('channel-123', 'user-456', 'guild-789');
  if (!session.token || !sessionStore.isSessionValid(session.token)) {
    throw new Error('Falha na criação da sessão!');
  }
  console.log(`   ✅ Sessão criada com sucesso! Token: ${session.token.slice(0, 10)}... (Expira em 24h)`);

  // 2. Testa Geração de QR Code
  console.log('2️⃣ Testando Geração de Buffer de QR Code...');
  const qrBuffer = await generateQrCodeBuffer(`https://teste.com/upload/${session.token}`);
  if (!Buffer.isBuffer(qrBuffer) || qrBuffer.length < 500) {
    throw new Error('QR Code inválido ou vazio!');
  }
  console.log(`   ✅ Buffer do QR Code gerado! Tamanho: ${qrBuffer.length} bytes (PNG válido)`);

  // 3. Testa Servidor Fastify (Injeção de requisições HTTP)
  console.log('3️⃣ Testando Servidor Web e Endpoints...');
  const app = createServer(mockClient);
  await app.ready();

  // Teste 3.1: Validação de Sessão Válida
  const resValid = await app.inject({
    method: 'GET',
    url: `/api/session/${session.token}`
  });
  const dataValid = JSON.parse(resValid.payload);
  if (resValid.statusCode !== 200 || !dataValid.valid) {
    throw new Error(`Falha na validação de sessão ativa: ${resValid.payload}`);
  }
  console.log('   ✅ GET /api/session/:token (sessão válida) -> 200 OK');

  // Teste 3.2: Sessão Inexistente
  const resInvalid = await app.inject({
    method: 'GET',
    url: '/api/session/token-fantasma-123'
  });
  if (resInvalid.statusCode !== 404) {
    throw new Error('Sessão fantasma deveria retornar 404');
  }
  console.log('   ✅ GET /api/session/invalid-token -> 404 Not Found');

  // Teste 3.3: Página HTML de Upload
  const resHtml = await app.inject({
    method: 'GET',
    url: `/upload/${session.token}`
  });
  if (resHtml.statusCode !== 200 || !resHtml.payload.includes('Envio de Fotos')) {
    throw new Error('Falha ao servir index.html');
  }
  console.log('   ✅ GET /upload/:token -> 200 OK (HTML renderizado com sucesso)');

  await app.close();

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
