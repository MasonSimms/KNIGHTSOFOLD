import { tuning } from './content/tuning';

tuning.eras.changeGameplay = false;
// ...and the round extras the game has on (weapons arriving, mixed starts, props lying around) are off, so each test sees only what it is about.
tuning.spawn.enabled = false;
tuning.eras.mixStarts = false;
tuning.eras.gunRounds = false;
tuning.props.lying = false;
tuning.match.quickRounds = false; // (the match as it was: one round per era, the museum after every one, no countdown; src/sim/quick.test.ts turns it on)
