# Net lab (2026-10-07 13:24)

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
| Wired, nearby | 63% | 12.1 / 28 cm | 3.6 cm (3%) | 38 cm | 0.0 | 0 |
| Home wifi | 92% | 13.8 / 27 cm | 4.2 cm (4%) | 73 cm | 0.0 | 0 |
| Busy wifi | 53% | 11.7 / 28 cm | 10.6 cm (16%) | 93 cm | 0.0 | 0 |
| Coast to coast | 51% | 10.4 / 27 cm | 5.1 cm (18%) | 42 cm | 0.0 | 0 |

## Everyone else
What you see of the others is this far in the past (the wire plus the blend buffer). Stalls = times a minute the picture of them had to
wait for a snapshot; carried on = times it ran past the newest one and carried the motion on instead.

| Connection | Others shown (avg / 95%) | Buffer (ticks) | Stalls a minute | Carried on a minute | Desyncs | Data down |
|---|---|---|---|---|---|---|
| Wired, nearby | 65 / 71 ms | 3.0 | 0.0 | 0.0 | 0 | 84 KB/s |
| Home wifi | 125 / 201 ms | 5.5 | 2.7 | 15.3 | 0 | 85 KB/s |
| Busy wifi | 190 / 212 ms | 8.3 | 2.0 | 18.7 | 0 | 85 KB/s |
| Coast to coast | 157 / 200 ms | 6.6 | 4.0 | 15.3 | 0 | 84 KB/s |
