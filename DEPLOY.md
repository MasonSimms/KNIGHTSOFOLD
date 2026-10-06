# Putting Knights of Old online

Two pieces: the **game page** (static files) and the **room server** (a small Node program that runs the fights).

## Run it on your own computer first

```powershell
npm run server        # the room server, port 8080
npm run dev           # the game, in a second terminal
```
Open `http://localhost:5173/?online` in two browser tabs: one makes a room, the other joins with the 4-letter code, the first one presses Start.
`http://localhost:5173/?lag=100` plays solo through a pretend 100 ms network (no server needed).

## Cheapest ways to host (prices are approximate: check the provider's page before you commit)

| Piece | Option | Cost | Notes |
|---|---|---|---|
| Game page | **Cloudflare Pages** | free | Build `npm run build`, publish the `dist` folder. Set `VITE_SERVER_URL=wss://<your-server-address>` when building. |
| Room server | **Fly.io** (recommended) | a few cents to ~$3 a month | `fly.toml` is ready: the machine stops when nobody plays and wakes in a couple of seconds on the next connection. Needs a card on file. |
| Room server | **Render free web service** | $0 | Sleeps after 15 min idle, the first player waits about 50 s for it to wake. Fine for testing with friends. Uses the `Dockerfile`. |
| Room server | **Railway** | about $5 a month | Simplest setup, but not the cheapest. |
| Room server | Oracle Cloud "Always Free" VM | $0 | Truly free but you set up and look after a Linux machine yourself. Not recommended for a beginner. |

**How much server do you need?** One 4-player room costs roughly 10% of one small CPU core. A shared-1x machine holds about 5-6 rooms at once (`MAX_ROOMS` caps it so one busy night cannot freeze every fight). More players than that: raise the machine size or run a second server.

## Deploying the server to Fly.io

1. Make an account at fly.io and install their `fly` tool.
2. In this folder: `fly launch --no-deploy` (accept the existing `fly.toml`; pick a unique app name), then `fly deploy`.
3. Your server address is `wss://<app-name>.fly.dev`. Use it as `VITE_SERVER_URL` when you build the game page.

## First deploy, step by step (Windows PowerShell)

You do the sign-ups (they need your email and, for Fly.io, a card); every other step is a command to paste.

**A. The room server (Fly.io, Virginia)**
1. Sign up at https://fly.io. You pay only for the minutes the server runs (it sleeps when nobody plays).
2. Install their tool: `iwr https://fly.io/install.ps1 -useb | iex`, then close PowerShell and open it again.
3. `fly auth login` (a browser window opens: log in there).
4. `cd C:\Users\User\knights-of-old`, then `fly launch --no-deploy`. Say yes to copying the existing configuration, pick a unique app name
   (for example `knights-of-old-yourname`) and keep the region `iad` (Ashburn, Virginia: closest to an East Coast group).
5. `fly deploy` (2-3 minutes). Your server address is `wss://<your-app-name>.fly.dev`.

**B. The game page (Cloudflare Pages, free)**
1. Sign up at https://dash.cloudflare.com.
2. Build the page pointing at your server: `$env:VITE_SERVER_URL = "wss://<your-app-name>.fly.dev"; npm run build`
3. In the Cloudflare dashboard: Workers & Pages, Create, Pages, Upload assets. Name the project `knights-of-old`, then drag the `dist`
   folder in. Your game is at `https://knights-of-old.pages.dev` (or the name it gives you).
4. Updating later: run step 2 again, then in the dashboard open the project and upload `dist` as a new deployment.

**C. Check it**: open the link in Chrome on two computers (or a normal and a private window), click Online, make a room on one and join
with the code on the other. Then put the link into HOWTOPLAY.md and send that to your friends.
