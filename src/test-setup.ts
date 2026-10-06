import { tuning } from './content/tuning';

tuning.eras.changeGameplay = false;
// ...and the round extras the game has on (weapons arriving, mixed starts, props lying around) are off, so each test sees only what it is about.
tuning.spawn.enabled = false;
tuning.eras.mixStarts = false;
tuning.props.lying = false;
