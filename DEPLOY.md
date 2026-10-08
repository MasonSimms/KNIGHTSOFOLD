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

After any change: `npm run deploy`. That updates the page and the server together (they must always match: a page from another version
is told "the game has been updated: reload"). A deploy restarts the server and ends every fight on it (the 2026-10-06 playtest lost its
match that way), so `npm run deploy` first asks the live server and refuses while anyone is fighting. `npm run deploy -- --force` goes
up anyway: anyone in a fight is told to make a new room in a minute.
It also refuses a copy that is behind GitHub's master (it would put older code live and undo other windows' fixes: on 2026-10-08 a
stale checkout went live over the day's online fixes) or has unsaved changes; `npm run deploy -- --stale` skips that. Each release is
labelled with its commit: `fly releases --app knightsofold --image` shows what is live.

## Checking on it

- `https://knightsofold.fly.dev/health` says `ok`, how many rooms are open and how many are in a fight.
- `fly logs` shows what the server is doing, but only its last 100 lines. The whole history (a playtest night's connection reports) is kept in
  `/data/server.log` on a 1 GB volume (2026-10-07): `fly ssh console --app knightsofold -C "tail -n 3000 /data/server.log"` (the machine must be
  awake: open the game page first, or `fly machine start`). `fly status` says whether it is awake. During a fight, every 30 s, one line per player: `net ABCD seat 1: ping 45 ms (worst 80), buffer 3.6 ticks, stalls 0, ... | its inputs: ...` (a high ping or many stalls: that player's connection), and once a minute `server: ... the loop ran up to N ms late`: over 50 ms, often, means the server itself fell behind (on Fly.io, most likely its shared CPU being held back) and everyone stuttered.
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

Deploy from committed code only (2026-10-07): `fly deploy` packs up the folder as it stands, including half-done edits from another window. When two windows work at once, deploy from a clean checkout of the last commit: `git worktree add --detach ..\deploy-tmp HEAD`, then `fly deploy` inside that folder, then `git worktree remove --force ..\deploy-tmp`. (The page and the server are always built together, so they match each other either way.)

## The fast lane (UDP, 2026-10-07)

Besides the WebSocket, each page opens a WebRTC data channel to the server (`server/fast.ts`, `src/net/fast.ts`): snapshots and inputs
go both ways at once, and a lost message on the fast lane is simply skipped instead of holding everything up. Fly.io only does UDP on a
**dedicated IPv4** (`169.155.52.222`, $2 a month: `fly ips list`), so `fly.toml` has a `[[services]]` block for UDP port 7777 and the
address in `RTC_PUBLIC_IP`. If the address ever changes, change it there too. A page that cannot open the fast lane (a network that
blocks UDP) plays over the WebSocket as before. The F3 overlay says which: `fast lane` or `WebSocket only`; so does each player's line in
`fly logs`.
