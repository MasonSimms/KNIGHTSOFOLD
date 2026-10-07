# Putting Knights of Old online

One Fly.io app holds everything (owner, 2026-10-06): the **room server** (runs the fights) also hands out the **game page**. One sign-up,
one command to update. It sleeps when nobody plays (you pay only for the minutes it runs: roughly $0-3 a month) and wakes in about two
seconds when someone opens the link. The server sits in Ashburn, Virginia (`iad`: US East).

## First time (Windows PowerShell): about 30 minutes

You do the sign-up (it needs your email and a card); every other step is a command to paste.

1. Sign up at https://fly.io and add a card (Billing).
2. Install their tool: `iwr https://fly.io/install.ps1 -useb | iex`, then close PowerShell and open it again.
3. Log in: `fly auth login` (a browser window opens: log in there).
4. Go to the game's folder: `cd C:\Users\User\knights-of-old`
5. Make the app, with a name nobody has taken yet (lowercase, dashes): `fly apps create knights-of-old-YOURNAME` (done: the app is **knightsofold**)
   Then put that name in `fly.toml` on the line `app = "..."` (or tell Claude the name and it does it).
6. Send it up: `fly deploy` (the first time takes 3-6 minutes: Fly.io builds the game on its own machines).
7. Your game is at `https://knightsofold.fly.dev`. Open it, click **Online**, **Make a room**, then **Copy invite link** and
   send that link to your friends. They open it, pick a look, press Ready; you press **To Battle**.

## Two things Fly.io needed after the first deploy (done 2026-10-06; keep them in mind)

- **An address.** The first `fly deploy` started the game but gave it no internet address, so the browser said the site could not be found.
  Fixed with `fly ips allocate-v6` and `fly ips allocate-v4 --shared` (both free). A home router can remember the "not found" for
  about 5 minutes afterwards: wait, or try on a phone with Wi-Fi off.
- **Exactly one server.** Fly.io started two copies of the server, but the rooms live inside one: a friend could land on the other copy and
  be told there is no such room. Fixed with `fly scale count 1`. Later deploys keep it at one.
- **Do not use the Deploy button on Fly.io's website** (it offers to merge files into GitHub and deploy from there): it deploys whatever
  GitHub has, which is older than this computer. Always `fly deploy` from PowerShell in this folder.

## Updating it later

After any change: `fly deploy`. That updates the page and the server together (they must always match: a page from another version
is told "the game has been updated: reload"). Anyone in a fight while it updates is told to make a new room in a minute.

## Checking on it

- `https://knightsofold.fly.dev/health` says `ok` and how many rooms are open.
- `fly logs` shows what the server is doing; `fly status` whether it is awake.
- One 4-player room costs roughly 10% of one small CPU core; this machine holds about 5-6 rooms at once (`MAX_ROOMS` in `fly.toml`).

## On your own computer (no internet needed)

```powershell
npm run build         # the game page, into dist
npm run server        # the room server: it serves that page too, at http://localhost:8080
```
Open `http://localhost:8080/?online` in two browser tabs: one makes a room, the other opens the invite link. While working on the game,
`npm run dev` (http://localhost:5173/?online) uses the server for the rooms and the live code for the page.
`http://localhost:5173/?lag=100` plays solo through a pretend 100 ms network (no server needed).

## Other ways (not used)

The page could live on Cloudflare Pages (free) with only the rooms on Fly.io (build with `$env:VITE_SERVER_URL = "wss://<app>.fly.dev"`),
or everything on Render's free tier (no card, but it sleeps after 15 minutes and the first player then waits about 50 seconds).
