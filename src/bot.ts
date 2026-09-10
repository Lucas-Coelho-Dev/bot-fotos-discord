import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Interaction,
  Events,
} from 'discord.js';
import { config } from './config.js';
import * as fotoCommand from './commands/foto.js';
import * as setupCommand from './commands/setup.js';
import { handleChannelButton } from './interactions/channelButton.js';

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

export async function registerCommands(): Promise<void> {
  if (!config.discordToken || !config.clientId) {
    console.warn('⚠️ Token ou Client ID ausentes. Pulei o registro de comandos Slash.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commandsData = [
    fotoCommand.data.toJSON(),
    setupCommand.data.toJSON(),
  ];

  try {
    console.log('🔄 Registrando comandos Slash no Discord...');

    if (config.guildId) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: commandsData }
        );
        console.log(`✅ Comandos registrados com sucesso no servidor ID: ${config.guildId}!`);
        return;
      } catch (err: any) {
        if (err?.code === 50001) {
          console.warn(`⚠️ O bot ainda não está no servidor ou não tem permissão no servidor ${config.guildId}.`);
          console.warn(`👉 Convide o bot com este link: https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=268437520&scope=bot%20applications.commands`);
          console.log('🔄 Registrando comandos globalmente como alternativa...');
        } else {
          throw err;
        }
      }
    }

    // Registro global (caso não tenha guildId ou deu fallback)
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commandsData }
    );
    console.log('✅ Comandos registrados globalmente no Discord!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos Slash:', error);
  }
}

export function setupEventHandlers(): void {
  discordClient.once(Events.ClientReady, (c) => {
    console.log(`🤖 Bot conectado com sucesso como: ${c.user.tag}`);
  });

  discordClient.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'foto') {
          await fotoCommand.execute(interaction);
        } else if (interaction.commandName === 'setup-painel') {
          await setupCommand.execute(interaction);
        }
      } else if (interaction.isButton()) {
        if (interaction.customId === 'btn_create_private_channel') {
          await handleChannelButton(interaction);
        }
      }
    } catch (err) {
      console.error('Erro ao processar interação:', err);
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao processar esta ação.',
          ephemeral: true,
        }).catch(() => null);
      }
    }
  });
}

export async function initBot(): Promise<void> {
  if (!config.discordToken) {
    console.warn('⚠️ DISCORD_TOKEN não foi configurado no arquivo .env. O bot não conectará até que seja preenchido.');
    return;
  }

  setupEventHandlers();
  await registerCommands();
  await discordClient.login(config.discordToken);
}
