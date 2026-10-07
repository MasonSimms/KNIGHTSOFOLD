# Net lab (2026-10-07 22:53)

90 s of the real game per connection, one player online against three bots on the server (seed 11). Made by npm run netlab
(src/tools/netlab.lab.ts). The connections are guesses until the playtest night's server log says what friends really have.

## Your own buttons
How long a press takes to be used by the server (one way across the wire plus the wait in the server's queue), and what the server's
queue of your inputs did. Every input waiting in it is another tick (17 ms) before your press counts for everyone else.

| Connection | Ping | Press to server (avg / 95%) | Inputs waiting (avg) | Ticks with none arrived | Folded |
|---|---|---|---|---|---|
| Wired, nearby | 30 ms | 41 / 49 ms | 1.04 | 0.0% | 0 |
| Home wifi | 60 ms | 61 / 76 ms | 1.09 | 0.8% | 41 |
| Busy wifi | 80 ms | 83 / 93 ms | 1.06 | 7.2% | 386 |
| Coast to coast | 90 ms | 75 / 90 ms | 1.08 | 1.6% | 85 |

## Your own fighter (prediction)
Your fighter moves the moment you press, guessed on your screen; the server checks the guess every snapshot. Off = how far the guess was
from the server in a fight (it is pulled back smoothly); snaps = jumps straight to the server (more than 1.5 m off; the
jumps at a new round are counted apart, they are meant). Predicting =
share of the time your fighter was moved by your own screen (the rest: knocked down, held, dead, between rounds: the server moves you).

| Connection | Predicting | Off (avg / 95%) | Off with nobody near (share of the time) | Worst | Snaps a minute | (at new rounds) |
|---|---|---|---|---|---|---|
| Wired, nearby | 59% | 9.6 / 28 cm | 4.2 cm (15%) | 48 cm | 0.0 | 0 |
| Home wifi | 63% | 10.4 / 29 cm | 4.0 cm (7%) | 70 cm | 0.0 | 0 |
| Busy wifi | 36% | 10.9 / 31 cm | 8.3 cm (21%) | 167 cm | 0.7 | 0 |
| Coast to coast | 60% | 10.2 / 29 cm | 7.3 cm (19%) | 96 cm | 0.0 | 0 |

## Everyone else
What you see of the others is this far in the past (the wire plus the blend buffer). Stalls = times a minute the picture of them had to
wait for a snapshot; carried on = times it ran past the newest one and carried the motion on instead.

| Connection | Others shown (avg / 95%) | Buffer (ticks) | Stalls a minute | Carried on a minute | Desyncs | Data down (compressed) |
|---|---|---|---|---|---|---|
| Wired, nearby | 67 / 73 ms | 3.1 | 0.0 | 0.0 | 0 | 88 KB/s (19 KB/s) |
| Home wifi | 97 / 130 ms | 3.8 | 0.0 | 21.3 | 0 | 88 KB/s (17 KB/s) |
| Busy wifi | 177 / 210 ms | 7.5 | 0.0 | 46.0 | 0 | 89 KB/s (19 KB/s) |
| Coast to coast | 112 / 144 ms | 3.9 | 0.0 | 43.3 | 0 | 88 KB/s (20 KB/s) |

## The server
One room's work each tick (the fight, its snapshot): 3.24 ms on this computer, 19% of one core. A Fly.io shared CPU may use 6.25% of a core
before it spends its saved-up time (at most 500 s), and is then held to 6.25%, stopping for the rest of every 80 ms: a stutter for everyone.
A performance CPU is never held back.
