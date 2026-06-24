# Deploying fastrak with Docker on DigitalOcean

This is the step-by-step for getting the app online. The whole app ships as **two
containers** — the Next.js web app and a Postgres database — wired together by
`docker-compose.yml`. You run one command and Docker builds and starts both.

> **Why this setup?** One flat-rate VPS, a co-located database, and a plain
> `docker compose up`. No metered serverless billing, and the exact same stack
> can later be lifted onto a client's local mini-PC (see "Local exit" below).
> See `docs/adr/` for the reasoning.

---

## What's in the box

| File | Role |
|------|------|
| `Dockerfile` | Builds the web app into a small production image |
| `docker-compose.yml` | Runs the app **+** Postgres together |
| `docker-entrypoint.sh` | On boot: wait for DB → apply schema → seed admin → start |
| `.env.example` | The secrets you must fill in (copy to `.env`) |

The app talks to Postgres over the private Docker network using the hostname
`db` — that's set for you inside `docker-compose.yml`, so you never wire up
`DATABASE_URL` by hand.

---

## A. Try it locally first (optional, needs Docker Desktop)

```bash
cp .env.example .env          # then edit .env: set SESSION_SECRET + ADMIN_PASSWORD
docker compose up -d --build
```

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Stop it with `docker compose down` (your data survives in the `pgdata` volume).

> Day-to-day development does **not** use Docker — keep using `npm run dev` on
> `:3001`, which runs on the local PGlite store. Docker is only for the
> production-shaped run.

---

## B. Deploy to a DigitalOcean droplet

### 1. Create the droplet

In the DigitalOcean dashboard: **Create → Droplets**.
- **Marketplace image:** "Docker on Ubuntu" (Docker + Compose pre-installed).
- **Size:** the smallest shared-CPU plan is fine to start (1–2 GB RAM).
- Add your **SSH key** so you can log in.

When it's up, copy its **public IP**.

### 2. Get the code onto the droplet

Open a terminal on the droplet — easiest is the **web console**: in the
DigitalOcean dashboard, open the droplet → **Access** → **Launch Droplet
Console** (no SSH key needed). Then install git and clone the repo.

The repo is **private**, so you need a read-only **GitHub token** to clone it:
on GitHub → *Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token* → give it **Read-only** access to the
`fastrak` repo. Copy the token (starts with `github_pat_…`).

```bash
apt-get update && apt-get install -y git
git clone https://YOUR_GITHUB_USERNAME:YOUR_TOKEN@github.com/jdaquantummatrix-del/fastrak.git
cd fastrak
```

(The token is only used for this one clone; you can delete it from GitHub after.)

### 3. Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Set, at minimum:

```env
SESSION_SECRET=<paste a long random string: run `openssl rand -hex 32`>
POSTGRES_PASSWORD=<a strong database password>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<the password you'll first log in with>
```

Save (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 4. Build and start

```bash
docker compose up -d --build
```

First run takes a few minutes (it builds the image, starts Postgres, applies the
schema, and creates your admin user). Check it:

```bash
docker compose ps          # both services "running"/"healthy"
docker compose logs -f app # watch the app boot; Ctrl+C to stop watching
```

Visit **http://YOUR_DROPLET_IP:3000** and sign in. **Change the admin password**
from *Manage access* (or *My account*) right away.

### 5. Load real data (when Kennard sends it)

The schema is applied automatically. To import a client's exported tables, run
the importers inside the running container:

```bash
docker compose exec app npm run db:import
```

---

## C. Put it on a domain with HTTPS (recommended)

Running on `:3000` over plain HTTP is fine for a first test, but for real use add
a reverse proxy that terminates HTTPS. The simplest is **Caddy**, which gets a
free certificate automatically. Point an `A` record for your domain at the
droplet IP, then add a `caddy` service in front of the app (ask and I'll wire
this into `docker-compose.yml` — it's a small addition once you have the domain).

---

## D. Backups

Your data lives in the `pgdata` Docker volume. Take a dump regularly:

```bash
docker compose exec db pg_dump -U postgres fastrak > backup-$(date +%F).sql
```

Restore into a fresh stack:

```bash
cat backup-2026-06-23.sql | docker compose exec -T db psql -U postgres fastrak
```

Keep copies off the droplet (e.g. DigitalOcean Spaces).

---

## E. Updating after code changes

```bash
git pull
docker compose up -d --build
```

The entrypoint re-applies the schema (idempotent) and leaves the admin account
and data intact.

---

## F. Local exit (dropping cloud fees later)

Because the whole thing is just Docker + a Postgres dump, a client can run the
**same** stack on a local mini-PC: install Docker, copy the repo + a `pg_dump`
of their database, `docker compose up -d --build`, and restore the dump. No code
changes — the app is identical whether it runs on a droplet or in their office.

---

## Common issues

- **`SESSION_SECRET` error on `up`** — you didn't set it in `.env`. Compose
  refuses to start the app without it (by design).
- **App restarts in a loop** — check `docker compose logs app`. Usually the DB
  wasn't healthy yet; it retries, but a wrong `POSTGRES_PASSWORD` mismatch
  between the `db` and `app` env will block it (they both read the same
  `.env` value, so don't override only one).
- **Can't reach `:3000`** — open the firewall: `ufw allow 3000` (or, once Caddy
  is in front, allow `80` and `443` instead).
