# Net lab (2026-10-07 20:15)

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
| Wired, nearby | 49% | 11.9 / 34 cm | 3.1 cm (14%) | 57 cm | 0.0 | 0 |
| Home wifi | 66% | 10.4 / 26 cm | 4.9 cm (7%) | 85 cm | 0.0 | 0 |
| Busy wifi | 54% | 9.8 / 27 cm | 3.7 cm (15%) | 61 cm | 0.0 | 1 |
| Coast to coast | 67% | 8.7 / 24 cm | 4.6 cm (14%) | 128 cm | 0.0 | 0 |

## Everyone else
What you see of the others is this far in the past (the wire plus the blend buffer). Stalls = times a minute the picture of them had to
wait for a snapshot; carried on = times it ran past the newest one and carried the motion on instead.

| Connection | Others shown (avg / 95%) | Buffer (ticks) | Stalls a minute | Carried on a minute | Desyncs | Data down (compressed) |
|---|---|---|---|---|---|---|
| Wired, nearby | 67 / 73 ms | 3.1 | 0.0 | 0.0 | 0 | 87 KB/s (17 KB/s) |
| Home wifi | 97 / 130 ms | 3.8 | 0.0 | 21.3 | 0 | 86 KB/s (16 KB/s) |
| Busy wifi | 177 / 210 ms | 7.5 | 0.0 | 46.0 | 0 | 87 KB/s (18 KB/s) |
| Coast to coast | 112 / 144 ms | 3.9 | 0.0 | 43.3 | 0 | 86 KB/s (15 KB/s) |

## The server
One room's work each tick (the fight, its snapshot): 0.92 ms on this computer, 6% of one core. A Fly.io shared CPU may use 6.25% of a core
before it spends its saved-up time (at most 500 s), and is then held to 6.25%, stopping for the rest of every 80 ms: a stutter for everyone.
A performance CPU is never held back.
