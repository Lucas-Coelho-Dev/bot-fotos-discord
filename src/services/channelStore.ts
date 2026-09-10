import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

class ChannelStore {
  private userChannels: Map<string, string> = new Map(); // userId -> channelId

  constructor() {
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): void {
    if (!fs.existsSync(CHANNELS_FILE)) return;
    try {
      const content = fs.readFileSync(CHANNELS_FILE, 'utf-8');
      const obj = JSON.parse(content);
      for (const [userId, channelId] of Object.entries(obj)) {
        this.userChannels.set(userId, channelId as string);
      }
    } catch (err) {
      console.error('Erro ao carregar channels.json:', err);
    }
  }

  private save(): void {
    try {
      const obj = Object.fromEntries(this.userChannels.entries());
      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar channels.json:', err);
    }
  }

  public getChannelForUser(userId: string): string | undefined {
    return this.userChannels.get(userId);
  }

  public setChannelForUser(userId: string, channelId: string): void {
    this.userChannels.set(userId, channelId);
    this.save();
  }

  public removeChannelForUser(userId: string): void {
    this.userChannels.delete(userId);
    this.save();
  }
}

export const channelStore = new ChannelStore();
