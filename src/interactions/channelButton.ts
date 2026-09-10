import {
  ButtonInteraction,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  TextChannel
} from 'discord.js';
import { channelStore } from '../services/channelStore.js';
import { config } from '../config.js';

export async function handleChannelButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== 'btn_create_private_channel') return;

  const guild = interaction.guild;
  const user = interaction.user;

  if (!guild) {
    await interaction.reply({
      content: 'Este botão só pode ser utilizado dentro de um servidor.',
      ephemeral: true,
    });
    return;
  }

  // 1. Verifica se já existe registro de canal para este colaborador
  const existingChannelId = channelStore.getChannelForUser(user.id);
  if (existingChannelId) {
    const channel = await guild.channels.fetch(existingChannelId).catch(() => null);
    if (channel) {
      await interaction.reply({
        content: `👋 Você já possui um canal exclusivo de atendimento: <#${channel.id}>`,
        ephemeral: true,
      });
      return;
    } else {
      // Canal foi deletado manualmente no servidor; removemos o registro para recriar
      channelStore.removeChannelForUser(user.id);
    }
  }

  // 2. Cria o novo canal privado fixo
  await interaction.deferReply({ ephemeral: true });

  try {
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    const channelName = `privado-${cleanUsername || user.id.slice(-4)}`;

    // Permissões de overwrite
    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ];

    // Se configurado cargo de Administrador/Gerente no .env, concede acesso
    if (config.adminRoleId) {
      permissionOverwrites.push({
        id: config.adminRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    // Verifica se a categoria configurada realmente existe e é do tipo Categoria
    let validParentId: string | undefined = undefined;
    if (config.categoryId) {
      const parentChannel = await guild.channels.fetch(config.categoryId).catch(() => null);
      if (parentChannel && parentChannel.type === ChannelType.GuildCategory) {
        validParentId = parentChannel.id;
      } else {
        console.warn(`⚠️ O ID "${config.categoryId}" configurado em DISCORD_CATEGORY_ID não é uma Categoria no Discord. O canal será criado na raiz.`);
      }
    }

    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: validParentId,
      permissionOverwrites,
    }) as TextChannel;

    // Salva a associação no store
    channelStore.setChannelForUser(user.id, newChannel.id);

    // Envia mensagem de boas-vindas no novo canal
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`👋 Canal Particular - ${user.displayName || user.username}`)
      .setDescription(
        `Olá <@${user.id}>! Este é o seu espaço privado para atendimento e recebimento de fotos.\n\n` +
        `📸 **Como receber fotos de um cliente ou colaborador:**\n` +
        `1. Digite o comando \`/foto\` neste chat.\n` +
        `2. Um **QR Code** será gerado automaticamente (válido por **24 horas**).\n` +
        `3. O cliente escaneia com a câmera do celular, preenche o nome, loja e envia até 3 fotos.\n` +
        `4. O bot entregará as fotos diretamente aqui neste canal!`
      )
      .setFooter({ text: 'Sistema de Atendimento de Fotos' })
      .setTimestamp();

    await newChannel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed] });

    // Notifica o colaborador privadamente com o link para o canal
    await interaction.editReply({
      content: `✅ Seu canal particular foi criado com sucesso!\n👉 Acesse aqui: <#${newChannel.id}>`,
    });
  } catch (err: any) {
    console.error('Erro ao criar canal particular:', err);
    await interaction.editReply({
      content: `❌ Ocorreu um erro ao criar seu canal. Verifique se o bot possui permissão de "Gerenciar Canais". Erro: ${err?.message || 'Desconhecido'}`,
    });
  }
}
