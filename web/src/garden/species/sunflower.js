import { createBotanical, disposeBotanical } from './flowerParts.js';
import { sunflowerConfig } from './sunflower.config.js';
export const createSunflower = (_THREE, options) => createBotanical(_THREE, sunflowerConfig, options);
export const disposeSunflower = disposeBotanical;
