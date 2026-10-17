import { daisyConfig } from './daisy.config.js';
import { createDaisy } from './daisy.js';
import { createBotanical, disposeBotanical } from './flowerParts.js';
import flowerParamsDocument from '../../../../data/flower_params.json';
import { createTemplateConfig } from './flowerTemplates.js';

const paramsById = new Map(flowerParamsDocument.species.map((entry) => [entry.id, entry]));

function stableHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

export function createSpeciesConfig(record) {
  // Keep the reviewed oxeye daisy identical to the approved reference model.
  if (record?.id === daisyConfig.id) return daisyConfig;
  const suggestion = paramsById.get(record?.id);
  if (suggestion) {
    const config = createTemplateConfig(suggestion.template, suggestion.parameters || suggestion.overrides || {});
    return {
      ...config,
      id: record.id,
      nameVi: record.name_vi || config.nameVi,
      scientificName: record.name_en || '',
      meaning: record.meaning || record.description || 'Thông tin đang được bổ sung.',
      bloomSeason: record.bloom_season || 'Mùa nở thay đổi theo giống và khí hậu.',
      care: record.long_description || record.description || 'Tham khảo điều kiện nắng, nước và đất phù hợp với loài hoa này.',
      // The dataset accent can be green (card/background color); retain the
      // morphology color suggestion in that case, otherwise use dataset color.
      color: suggestion.parameters?.petalColor || suggestion.overrides?.petalColor || config.color,
      flowerTemplateConfidence: suggestion.confidence,
      flowerTemplateFallback: suggestion.fallback_photo,
    };
  }
  const hash = stableHash(record?.id || 'flower');
  const base = record?.color || '#d58b91';
  // Keep a valid, readable fallback if a dataset entry has no display color.
  const palette = ['#e8a0ad', '#e7b86f', '#b2a2cd', '#e18c68', '#dca8c6', '#fff0d6'];
  let color = /^#[0-9a-f]{6}$/i.test(base) ? base : palette[hash % palette.length];
  const rgb = color.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) || [];
  if (rgb.length === 3) {
    const [red, green, blue] = rgb; const max = Math.max(...rgb); const min = Math.min(...rgb); const delta = max - min;
    let hue = 0;
    if (delta) hue = max === red ? 60 * (((green - blue) / delta) % 6) : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4);
    if (hue < 0) hue += 360;
    const name = `${record?.id || ''} ${record?.name_en || ''} ${record?.name_vi || ''}`.toLowerCase();
    // Dataset accent greens describe the card, not a green flower. Use a likely
    // flower color for common yellow species, otherwise a soft varied blossom.
    if (hue >= 78 && hue <= 165) color = /colt|sunflower|dandelion|yellow|marigold|buttercup|daffodil|gazania/.test(name) ? '#f2c64d' : palette[hash % palette.length];
  }
  const family = hash % 5;
  const shape = ['daisy', 'tulip', 'dahlia', 'lily', 'ray'][family];
  const counts = [18, 6, 22, 6, 14];
  const petals = counts[family];
  const center = family === 1 || family === 3 ? '#d5a24a' : '#c38d3e';
  return {
    id: record.id, nameVi: record.name_vi, scientificName: record.name_en || 'Tên khoa học chưa có trong dữ liệu',
    meaning: record.meaning || record.description || 'Thông tin đang được bổ sung.',
    bloomSeason: record.bloom_season || 'Mùa nở thay đổi theo giống và khí hậu.',
    care: record.long_description || record.description || 'Tham khảo điều kiện nắng, nước và đất phù hợp với loài hoa này.',
    color, center, centerRadius: family === 0 || family === 4 ? 0.25 : 0.13,
    shape, leaves: 3 + (hash % 2), leafLength: 0.72, leafWidth: 0.18,
    stem: '#66825d', stemRadius: 0.04, open: 0.84, wave: 0.025,
    layers: [
      { count: petals, length: family === 1 ? 0.78 : 0.72, width: family === 4 ? 0.10 : 0.19, pitch: family === 1 ? -0.62 : -0.12, color, phase: 0 },
      ...(family === 0 || family === 2 || family === 4 ? [{ count: Math.max(8, petals - 4), length: 0.58, width: 0.15, pitch: -0.4, color, phase: 0.14 }] : []),
    ],
    seedCount: family === 0 || family === 4 ? 32 : 0, seedSize: 0.014, seedColor: '#98703c',
  };
}

export function createFlower(THREE, id, options, speciesRecord) {
  const record = speciesRecord || { id, name_vi: id };
  const config = createSpeciesConfig(record);
  const root = id === daisyConfig.id
    ? createDaisy(THREE, options)
    : createBotanical(THREE, config, options);
  root.userData.disposeFlower = () => disposeBotanical(root);
  return root;
}

export function disposeFlower(root) { root?.userData.disposeFlower?.(); }
