# Playtests

What friends said and what changed. The first night: Sunday 2026-10-11, the owner and 3 friends, online, recorded.
It passes the gate if friends ask for another round and 4 players finish 10 fights online (ROADMAP.md).

## Sunday 2026-10-11: the checklist

**The day before or that morning**
1. Tell every Claude window: no deploys on Sunday evening. A deploy restarts the server and ends every fight.
2. Send the friends HOWTOPLAY.md (Chrome, mouse and keyboard).
3. Try it once yourself: open https://knightsofold.fly.dev, click **Online**, **Make a room**, add a bot, **Ready up**, **To Battle**.

**Half an hour before**
1. Open https://knightsofold.fly.dev/health. It should say `ok 0 rooms, 0 fighting`. The first visit wakes the server (a few seconds).
2. Start OBS recording.

**Starting a match**
1. Open https://knightsofold.fly.dev and click **Online**, then **Make a room**, then **Copy invite link**. Paste the link in the chat.
2. Each friend opens the link. They land straight in your room.
3. Everyone picks a hat, eyes and a colour, then clicks **Ready up**. You click **To Battle**.
4. A match is 12 rounds: four eras, three rounds each, about 10 minutes. Every round starts with 3, 2, 1. The winner is crowned and everyone goes
   back to the room. Ready up again for a rematch. (To play the old way, one round per era with the museum after every round: set
   quickRounds to false in src/content/tuning.ts, then deploy.)

**If something goes wrong**
- Someone drops out: they reload the page within a minute and get their seat and score back. Gone more than 5 s, their fighter dies
  that round and they are back in the next.
- "The game has been updated: reload": someone deployed. Everyone reloads and you make a new room.
- It feels laggy: the number in the bottom corner is that player's delay (amber means slow). Note who and when.
- To end a fight early (host): **Esc**. Everyone goes back to the room.

**Afterwards**
1. Save the night's server log (every player's connection, every 30 s), in PowerShell from the game's folder:
   `fly ssh console --app knightsofold -C "cat /data/server.log" > playtest-2026-10-11.log`
2. Tell Claude "the playtest is done". It writes up what happened below and asks you what felt wrong.

## What friends said

(After the night.)
