import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { sessionStore } from '../services/sessionStore.js';
import { generateQrCodeBuffer } from '../services/qrCodeService.js';
import { getPublicUrl } from '../services/tunnel.js';

export const data = new SlashCommandBuilder()
  .setName('foto')
  .setDescription('Gera um QR Code de 24 horas para recebimento de fotos pelo celular');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.channel;
  const user = interaction.user;
  const guild = interaction.guild;

  if (!channel || !guild) {
    await interaction.reply({
      content: 'Este comando só pode ser executado dentro de um servidor.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    // 1. Cria a sessão com validade de 24h vinculada ao canal atual
    const session = sessionStore.createSession(channel.id, user.id, guild.id);

    // 2. Obtém a URL pública (via Cloudflare Tunnel ou configurada)
    const baseUrl = getPublicUrl();
    const uploadUrl = `${baseUrl}/upload/${session.token}`;
    const qrUploadUrl = `${uploadUrl}?source=qr`;

    // 3. Gera a imagem do QR Code
    const qrBuffer = await generateQrCodeBuffer(qrUploadUrl);
    const qrAttachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode.png' });

    // 4. Monta o Embed explicativo
    const embed = new EmbedBuilder()
      .setColor(0x23A55A)
      .setTitle('📸 QR Code para Envio de Fotos')
      .setDescription(
        `Solicite que o cliente aponte a câmera do celular para o QR Code abaixo ou envie o link direto:\n\n` +
        `🔗 **Link direto:** [Abrir página de envio de fotos](${uploadUrl})\n` +
        `\`${uploadUrl}\``
      )
      .addFields(
        {
          name: '⏳ Validade',
          value: '24 horas (o cliente pode enviar novos lotes de fotos neste mesmo link)',
          inline: true,
        },
        {
          name: '📷 Limite',
          value: 'Até 3 fotos por envio (câmera ou galeria)',
          inline: true,
        },
        {
          name: '📋 Campos',
          value: 'Nome do cliente e Unidade/Loja onde trabalha',
          inline: true,
        }
      )
      .setImage('attachment://qrcode.png')
      .setFooter({
        text: `Solicitado por ${user.displayName || user.username} • As fotos chegarão automaticamente aqui neste chat!`,
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      files: [qrAttachment],
    });
  } catch (err: any) {
    console.error('Erro ao processar /foto:', err);
    await interaction.editReply({
      content: `❌ Ocorreu um erro ao gerar o QR Code: ${err?.message || 'Erro desconhecido'}`,
    });
  }
}
