import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  discordToken: string;
  clientId: string;
  guildId: string;
  categoryId?: string;
  adminRoleId?: string;
  port: number;
  publicUrl?: string;
}

export const config: Config = {
  discordToken: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID || '',
  categoryId: process.env.DISCORD_CATEGORY_ID || undefined,
  adminRoleId: process.env.ADMIN_ROLE_ID || undefined,
  port: parseInt(process.env.PORT || '3000', 10),
  publicUrl: process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : undefined,
};

export function validateConfig(): void {
  const missing: string[] = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.guildId) missing.push('DISCORD_GUILD_ID');

  if (missing.length > 0) {
    console.warn(`\n⚠️  ATENÇÃO: As seguintes variáveis precisam ser preenchidas no seu arquivo .env:`);
    missing.forEach(v => console.warn(`   - ${v}`));
    console.warn(`O servidor web iniciará normalmente, mas o bot do Discord aguarda suas credenciais.\n`);
  }
}
