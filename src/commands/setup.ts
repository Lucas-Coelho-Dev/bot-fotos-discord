import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup-painel')
  .setDescription('Publica a mensagem fixa com o botão de acesso aos canais particulares')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📸 Central de Atendimento & Envio de Fotos')
    .setDescription(
      'Bem-vindo(a) à central de atendimento!\n\n' +
      'Cada colaborador possui um **canal particular exclusivo** com o bot para gerar links e receber fotos de clientes e lojas.\n\n' +
      '👉 **Clique no botão abaixo** para criar ou acessar a sua sala particular.'
    )
    .setFooter({ text: 'Sistema Automatizado de Envio de Fotos' });

  const button = new ButtonBuilder()
    .setCustomId('btn_create_private_channel')
    .setLabel('Criar / Acessar meu Canal Particular')
    .setEmoji('📸')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await interaction.reply({
      content: 'Não foi possível enviar a mensagem neste canal.',
      ephemeral: true,
    });
    return;
  }

  await channel.send({ embeds: [embed], components: [row] });

  await interaction.reply({
    content: '✅ Painel publicado com sucesso neste canal!',
    ephemeral: true,
  });
}
