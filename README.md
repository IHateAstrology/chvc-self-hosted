# CHVC Crystal PM Assistant — Self-Hosted

Crystal PM support chatbot for Chapel Hills Vision Clinic, self-hosted on a Hetzner server using Google Gemini API.

## What it does

An AI assistant that helps CHVC staff with Crystal Practice Management software — scheduling, billing, insurance claims, patient records, inventory, and more.

## Stack

- **Node.js 20** + **Express** backend
- **Google Gemini 2.0 Flash** AI model (you pay for your own usage)
- Vanilla HTML/CSS/JS frontend
- Docker for deployment

## Quick Start (Hetzner Server)

### 1. SSH into your server

```bash
ssh root@87.99.146.54
```

### 2. Run the setup script

```bash
curl -fsSL https://raw.githubusercontent.com/IHateAstrology/chvc-self-hosted/main/deploy.sh | bash
```

This will:
- Install Docker and Git
- Clone this repo to `/opt/chvc`
- Prompt you to add your Gemini API key
- Build and start the Docker container on port **3060**

### 3. Get your Gemini API key

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with a Google account
3. Click **Create API key**
4. Copy the key

Then add it to the server:
```bash
nano /opt/chvc/.env
# Replace: GEMINI_API_KEY=your-gemini-api-key-here
# With:    GEMINI_API_KEY=AIza...your-actual-key
```

---

## Managing the app

```bash
cd /opt/chvc

# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update to latest version
git pull && docker compose up -d --build

# Health check
curl http://localhost:3060/api/health
```

---

## Updating the app

Whenever you want to deploy changes:

```bash
ssh root@87.99.146.54
cd /opt/chvc
git pull && docker compose up -d --build
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key (from aistudio.google.com) |
| `PORT` | Port to run on (default: 3060) |

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express backend + Gemini API integration |
| `knowledge.md` | Crystal PM knowledge base — edit to update AI responses |
| `public/` | Frontend (HTML, CSS, JS) — no build step required |
| `deploy.sh` | One-shot server setup script |
| `.env.example` | Environment variable template |
