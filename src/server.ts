import fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { Client, EmbedBuilder, AttachmentBuilder, TextChannel } from 'discord.js';
import { sessionStore } from './services/sessionStore.js';
import { config } from './config.js';
import { isPublicUrlReady } from './services/tunnel.js';

export function createServer(discordClient: Client): FastifyInstance {
  const app = fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024, // 50MB
  });

  // CORS
  app.register(fastifyCors, {
    origin: '*',
  });

  // Suporte a upload multipart (fotos)
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB por foto
      files: 3,                   // No máximo 3 fotos por upload
    },
  });

  // Servir arquivos estáticos (CSS, JS, imagens) da pasta public
  const publicDir = path.resolve(process.cwd(), 'public');
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  // O container só é considerado saudável quando o bot consegue atender
  // completamente: Discord conectado e URL pública disponível.
  app.get('/health', async (_req, reply) => {
    const discordReady = discordClient.isReady();
    const tunnelReady = isPublicUrlReady();
    const ready = discordReady && tunnelReady;

    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'starting',
      discordReady,
      tunnelReady,
    });
  });

  // Rota para a página de upload: /upload/:token
  app.get('/upload/:token', async (req, reply) => {
    return reply.sendFile('index.html');
  });

  // API para verificar se o token é válido
  app.get('/api/session/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = sessionStore.getSession(token);

    if (!session) {
      return reply.status(404).send({ valid: false, message: 'Sessão expirada ou inexistente.' });
    }

    return reply.send({
      valid: true,
      expiresAt: session.expiresAt,
    });
  });

  // API para obter a imagem do QR Code
  app.get('/api/qrcode/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = sessionStore.getSession(token);

    if (!session) {
      return reply.status(404).send('Sessão expirada ou inexistente');
    }

    try {
      const { getPublicUrl } = await import('./services/tunnel.js');
      const { generateQrCodeBuffer } = await import('./services/qrCodeService.js');
      const baseUrl = getPublicUrl();
      const uploadUrl = `${baseUrl}/upload/${token}?source=qr`;
      const qrBuffer = await generateQrCodeBuffer(uploadUrl);

      return reply.type('image/png').send(qrBuffer);
    } catch (err) {
      console.error('Erro ao gerar QR Code para a rota web:', err);
      return reply.status(500).send('Erro ao gerar imagem do QR Code');
    }
  });

  // API de Upload das Fotos
  app.post('/api/upload/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const session = sessionStore.getSession(token);

    if (!session) {
      return reply.status(400).send({
        success: false,
        message: 'Link de envio expirado ou inválido. Por favor, solicite um novo QR Code no Discord.',
      });
    }

    const fields: Record<string, string> = {};
    const uploadedFiles: Array<{ filename: string; buffer: Buffer; mimetype: string }> = [];

    // Processa os campos e arquivos multipart
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        uploadedFiles.push({
          filename: part.filename || `foto_${uploadedFiles.length + 1}.jpg`,
          buffer,
          mimetype: part.mimetype,
        });
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    const clientName = fields['clientName']?.trim();
    const workplace = fields['workplace']?.trim();

    if (!clientName || !workplace) {
      return reply.status(400).send({
        success: false,
        message: 'Por favor, preencha o Nome e o Local onde trabalha.',
      });
    }

    if (uploadedFiles.length === 0) {
      return reply.status(400).send({
        success: false,
        message: 'Nenhuma foto foi selecionada.',
      });
    }

    if (uploadedFiles.length > 3) {
      return reply.status(400).send({
        success: false,
        message: 'Você só pode enviar no máximo 3 fotos por vez.',
      });
    }

    // Envio para o Discord
    try {
      const channel = await discordClient.channels.fetch(session.channelId).catch(() => null);

      if (!channel || !(channel instanceof TextChannel)) {
        return reply.status(500).send({
          success: false,
          message: 'O canal do Discord não foi encontrado ou não está acessível.',
        });
      }

      // Prepara os anexos
      const attachments = uploadedFiles.map((file, idx) => {
        const ext = path.extname(file.filename) || '.jpg';
        return new AttachmentBuilder(file.buffer, {
          name: `foto_${Date.now()}_${idx + 1}${ext}`,
        });
      });

      // Data e hora formatada em fuso horário de Brasília
      const nowFormatted = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date());

      const embed = new EmbedBuilder()
        .setColor(0x23A55A)
        .setTitle('📸 Novo Lote de Fotos Recebido!')
        .setDescription(`Fotos enviadas diretamente pelo celular através do QR Code.`)
        .addFields(
          { name: '👤 Remetente / Cliente', value: clientName, inline: true },
          { name: '🏢 Unidade / Loja', value: workplace, inline: true },
          { name: '🕒 Horário de Envio', value: nowFormatted, inline: true },
          { name: '🖼️ Total de Fotos', value: `${uploadedFiles.length} foto(s)`, inline: true }
        )
        .setFooter({
          text: `Sessão ativa por 24h • Mais fotos podem ser enviadas no mesmo QR Code`,
        })
        .setTimestamp();

      await channel.send({
        content: `🔔 <@${session.userId}> Novas fotos recebidas de **${clientName}** (${workplace})!`,
        embeds: [embed],
        files: attachments,
      });

      console.log(`[Upload] ${uploadedFiles.length} fotos enviadas por "${clientName}" entregues no canal #${channel.name}`);

      return reply.send({
        success: true,
        message: 'Fotos entregues no Discord com sucesso!',
        count: uploadedFiles.length,
      });
    } catch (err: any) {
      console.error('Erro ao enviar fotos para o canal do Discord:', err);
      return reply.status(500).send({
        success: false,
        message: 'Falha ao entregar fotos no Discord. Tente novamente.',
      });
    }
  });

  return app;
}
