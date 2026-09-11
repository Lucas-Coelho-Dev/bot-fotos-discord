# 📸 Discord Photo Bot

Bot de atendimento para Discord desenvolvido em **TypeScript** com **discord.js v14**, servidor web **Fastify** para upload mobile de fotos e integração com **Cloudflare Tunnel** (HTTPS gratuito e automático).

---

## 🎯 Como Funciona

1. **Canais Fixos Particulares**:
   - Um administrador executa `/setup-painel` no canal principal para enviar a mensagem com botão.
   - Cada colaborador clica no botão e recebe seu próprio canal de atendimento privado (ex: `#privado-lucas`).
   - Se já tiver canal criado, o bot indica o canal existente.

2. **Geração de QR Code (`/foto`)**:
   - No canal particular, o colaborador digita `/foto`.
   - O bot cria uma sessão válida por **24 horas**, gera um QR Code e um link direto.
   - O cliente escaneia com o celular.

3. **Página Web Mobile**:
   - Interface responsiva com tema escuro (inspirada no Discord).
   - O cliente preenche **Seu Nome** e **Onde trabalha / Loja** (ex: *Lucas / Loja Vasco Barra Shopping*).
   - Pode tirar foto direto da câmera ou escolher da galeria (até 3 fotos por envio).
   - Visualização prévia das fotos com opção de remover.

4. **Entrega Automática no Discord**:
   - Ao confirmar o envio, o servidor recebe os arquivos e notifica o colaborador no Discord.
   - Publica um Embed detalhado com nome, loja, data/hora e anexa as fotos diretamente no chat.
   - Como a sessão dura 24h, o cliente pode enviar mais lotes de fotos usando o mesmo QR Code.

5. **Cloudflare Tunnel (Zero Configuração)**:
   - O bot inicia automaticamente um túnel seguro `trycloudflare.com` com HTTPS válido.
   - Não é necessário abrir portas no roteador nem configurar certificados SSL.

---

## 🚀 Instalação e Configuração

### 1. Criar o Bot no Discord Developer Portal
1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique em **New Application** e dê um nome (ex: `PhotoBot`).
3. Vá na aba **Bot**:
   - Clique em **Reset Token** e copie o token gerado.
   - Em **Privileged Gateway Intents**, ative:
     - ✅ **Server Members Intent**
     - ✅ **Message Content Intent**
4. Vá na aba **OAuth2** -> **URL Generator**:
   - Em **Scopes**, marque: `bot` e `applications.commands`.
   - Em **Bot Permissions**, marque:
     - `Manage Channels` (Gerenciar Canais)
     - `View Channels` (Ver Canais)
     - `Send Messages` (Enviar Mensagens)
     - `Embed Links` (Inserir Links)
     - `Attach Files` (Anexar Arquivos)
     - `Read Message History` (Ler Histórico)
   - Copie a URL gerada e abra no navegador para adicionar o bot ao seu servidor Discord.

---

### 2. Configurar o `.env`
Abra o arquivo `.env` na pasta do projeto e preencha:

```env
DISCORD_TOKEN=seu_bot_token_aqui
DISCORD_CLIENT_ID=seu_client_id_aqui
DISCORD_GUILD_ID=seu_guild_id_aqui
DISCORD_CATEGORY_ID=seu_category_id_aqui
ADMIN_ROLE_ID=
PORT=3000
PUBLIC_URL=
```

*Como obter os IDs:*
- Ative o **Modo de Desenvolvedor** no Discord (*Configurações de Usuário -> Avançado -> Modo de Desenvolvedor*).
- Clique com o botão direito no seu servidor -> **Copiar ID do Servidor** (`DISCORD_GUILD_ID`).
- Clique com o botão direito na categoria onde quer criar os canais -> **Copiar ID da Categoria** (`DISCORD_CATEGORY_ID`).
- `ADMIN_ROLE_ID`: (Opcional) ID do cargo de gerência para ter acesso aos canais privados.
- `PUBLIC_URL`: (Opcional) Deixe em branco para usar o Cloudflare Tunnel automático grátis.

---

### 3. Rodar o Bot

#### Modo Desenvolvimento:
```bash
npm run dev
```

#### Modo Produção:
```bash
npm run build
npm start
```

---

## ☁️ Como Rodar na Oracle Cloud (VPS Linux)

Na sua máquina virtual da Oracle (Ubuntu / Debian):

1. **Instalar Node.js 20+**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clonar ou copiar a pasta do projeto**:
   ```bash
   cd /home/ubuntu/discord-photo-bot
   npm install
   npm run build
   ```

3. **Rodar em segundo plano 24/7 com PM2**:
   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name "discord-photo-bot"
   pm2 save
   pm2 startup
   ```

---

## 🐳 Docker e Portainer

O projeto inclui uma imagem de produção em duas etapas e um arquivo Docker Compose pronto para uso. O contêiner:

- reinicia automaticamente com `restart: unless-stopped`;
- limita os logs a 3 arquivos de 10 MB;
- publica a aplicação na porta `3000`;
- salva canais e sessões no volume persistente `bot_fotos_data`;
- inclui o executável do Cloudflare Tunnel na imagem, evitando downloads a cada implantação;
- desativa a atualização automática do túnel para que o endereço público não mude durante a execução;
- executa como usuário sem privilégios;
- possui verificação automática de saúde.

### Executar com Docker Compose

1. Copie o arquivo de exemplo e preencha suas credenciais:

   ```bash
   cp .env.example .env
   ```

2. Construa e inicie o bot:

   ```bash
   docker compose up -d --build
   ```

3. Confira o estado e os logs:

   ```bash
   docker compose ps
   docker compose logs -f bot-fotos
   ```

### Implantar pelo Portainer

1. Entre no ambiente Docker local e abra **Stacks**.
2. Crie uma Stack chamada `bot-fotos`.
3. Use este repositório como origem ou cole o conteúdo de `docker-compose.yml`.
4. Cadastre as variáveis do `.env` na seção **Environment variables**.
5. Faça o deploy e confirme que o contêiner aparece como **healthy**.

> Nunca envie o arquivo `.env` ao GitHub. Ele contém o token do bot e está ignorado pelo Git.

## 💾 Persistência

Os arquivos `channels.json` e `sessions.json` são gravados em `/app/data`. No Docker Compose, esse caminho usa o volume nomeado `bot_fotos_data`, preservando os dados após atualizações e reinicializações.

## 📋 Requisitos

- Node.js 20 ou mais recente para execução local;
- Docker com Compose v2 para execução em contêiner;
- aplicação configurada no Discord Developer Portal;
- acesso de saída à internet para Discord e Cloudflare Tunnel.
