import { createBotanical, disposeBotanical } from './flowerParts.js';
import { tulipConfig } from './tulip.config.js';
export const createTulip = (_THREE, options) => createBotanical(_THREE, tulipConfig, options);
export const disposeTulip = disposeBotanical;
