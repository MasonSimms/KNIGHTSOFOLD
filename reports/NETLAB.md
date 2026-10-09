# Net lab (2026-10-09 17:15)

90 s of the real game per connection, one player online against three bots on the server (seed 11). Made by npm run netlab
(src/tools/netlab.lab.ts). The connections are guesses until the playtest night's server log says what friends really have.

## Your own buttons
How long a press takes to be used by the server (one way across the wire plus the wait in the server's queue), and what the server's
queue of your inputs did. Every input waiting in it is another tick (17 ms) before your press counts for everyone else.

| Connection | Ping | Press to server (avg / 95%) | Inputs waiting (avg) | Ticks with none arrived | Folded |
|---|---|---|---|---|---|
| Wired, nearby | 30 ms | 30 / 49 ms | 0.35 | 0.5% | 23 |
| Home wifi | 60 ms | 55 / 72 ms | 0.69 | 1.2% | 65 |
| Busy wifi | 80 ms | 82 / 93 ms | 0.98 | 7.2% | 389 |
| Coast to coast | 90 ms | 65 / 87 ms | 0.50 | 2.0% | 106 |

## Your own fighter (prediction)
Your fighter moves the moment you press, guessed on your screen; the server checks the guess every snapshot. Off = how far the guess was
from the server in a fight (it is pulled back smoothly); snaps = jumps straight to the server (more than 1.5 m off; the
jumps at a new round are counted apart, they are meant). Predicting =
share of the time your fighter was moved by your own screen (the rest: knocked down, held, dead, between rounds: the server moves you).

| Connection | Predicting | Off (avg / 95%) | Off with nobody near (share of the time) | Worst | Snaps a minute | (at new rounds) |
|---|---|---|---|---|---|---|
| Wired, nearby | 47% | 8.3 / 25 cm | 4.6 cm (29%) | 47 cm | 0.0 | 0 |
| Home wifi | 30% | 7.0 / 22 cm | 3.0 cm (51%) | 155 cm | 0.7 | 0 |
| Busy wifi | 56% | 9.5 / 29 cm | 3.8 cm (30%) | 122 cm | 0.0 | 0 |
| Coast to coast | 31% | 8.2 / 30 cm | 5.5 cm (38%) | 155 cm | 0.7 | 0 |

## Everyone else
What you see of the others is this far in the past (the wire plus the blend buffer). Stalls = times a minute the picture of them had to
wait for a snapshot; carried on = times it ran past the newest one and carried the motion on instead.

| Connection | Others shown (avg / 95%) | Buffer (ticks) | Stalls a minute | Carried on a minute | Desyncs | Data down (compressed) |
|---|---|---|---|---|---|---|
| Wired, nearby | 51 / 56 ms | 2.1 | 0.0 | 0.0 | 0 | 88 KB/s (19 KB/s) |
| Home wifi | 81 / 114 ms | 2.8 | 0.0 | 26.0 | 0 | 87 KB/s (18 KB/s) |
| Busy wifi | 160 / 194 ms | 6.5 | 0.0 | 76.0 | 0 | 87 KB/s (18 KB/s) |
| Coast to coast | 96 / 128 ms | 2.9 | 1.3 | 52.0 | 0 | 87 KB/s (18 KB/s) |

## The server
One room's work each tick (the fight, its snapshot): 0.83 ms on this computer, 5% of one core. A Fly.io shared CPU may use 6.25% of a core
before it spends its saved-up time (at most 500 s), and is then held to 6.25%, stopping for the rest of every 80 ms: a stutter for everyone.
A performance CPU is never held back.
