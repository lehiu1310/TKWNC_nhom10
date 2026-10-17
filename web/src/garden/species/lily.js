import { createBotanical, disposeBotanical } from './flowerParts.js';
import { lilyConfig } from './lily.config.js';
export const createLily = (_THREE, options) => createBotanical(_THREE, lilyConfig, options);
export const disposeLily = disposeBotanical;
