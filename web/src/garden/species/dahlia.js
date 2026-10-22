import { createBotanical, disposeBotanical } from './flowerParts.js';
import { dahliaConfig } from './dahlia.config.js';
export const createDahlia = (_THREE, options) => createBotanical(_THREE, dahliaConfig, options);
export const disposeDahlia = disposeBotanical;
