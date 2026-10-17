import { createBotanical, disposeBotanical } from './flowerParts.js';
import { daisyConfig } from './daisy.config.js';
export const createDaisy = (_THREE, options) => createBotanical(_THREE, daisyConfig, options);
export const disposeDaisy = disposeBotanical;
