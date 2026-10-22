import { daisyConfig } from './daisy.config.js';
import { createDaisy } from './daisy.js';
import { createBotanical, disposeBotanical } from './flowerParts.js';
import archetypeDocument from '../../../../data/flower_archetypes.json';
import photoColorDocument from '../../../../data/flower_photo_colors.json';
import { createTemplateConfig } from './flowerTemplates.js';

const archetypesById = new Map(archetypeDocument.species.map((entry) => [entry.id, entry]));
const photoColorsById = new Map(photoColorDocument.map((entry) => [entry.id, entry]));
const validHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

function isBotanicalPetalColor(value) {
  if (!validHex(value)) return false;
  const [r, g, b] = value.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  // A number of cards use foliage green as their UI accent. Don't turn that into
  // implausible green petals; the archetype preset remains the display palette.
  return !(hue >= 78 && hue <= 165 && max - min > 0.12);
}

function flowerColor(value, fallback) {
  return isBotanicalPetalColor(value) ? value : fallback;
}

function lighten(hex, amount = 0.22) {
  if (!validHex(hex)) return '#fff4ec';
  return `#${hex.slice(1).match(/../g).map((part) => Math.round(parseInt(part, 16) + (255 - parseInt(part, 16)) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function contentFields(record, config) {
  return {
    ...config,
    id: record.id,
    nameVi: record.name_vi || config.nameVi,
    scientificName: record.name_en || '',
    meaning: record.meaning || record.description || 'Thông tin đang được bổ sung.',
    bloomSeason: record.bloom_season || 'Mùa nở thay đổi theo giống và khí hậu.',
    care: record.long_description || record.description || 'Tham khảo điều kiện nắng, nước và đất phù hợp với loài hoa này.',
  };
}

export function createSpeciesConfig(record) {
  // Keep the reviewed oxeye daisy geometry and palette exactly as approved.
  if (record?.id === daisyConfig.id) return { ...contentFields(record, daisyConfig), flowerTemplateConfidence: 0.99, flowerTemplateFallback: false };
  const assignment = archetypesById.get(record?.id);
  const template = assignment?.archetype;
  const fallback = assignment?.fallback_photo || !template;
  // Complex silhouettes stay photographic until a dedicated shape is reviewed.
  // A safe base config lets the detail card continue to receive the same data.
  const config = createTemplateConfig(template && !fallback ? template : 'disk');
  const measured = photoColorsById.get(record?.id);
  // The centered crop sometimes catches leaves or another flower in a mixed
  // image. Require a substantial sample before replacing the curated template
  // color; keep all source values in species.json untouched for the audit.
  const measuredColorIsUsable = measured && measured.samples >= 500 && validHex(measured.photo_color);
  const hasPhotoColorMismatch = measuredColorIsUsable && measured.hue_difference > 58;
  const photoColorIsUsable = measuredColorIsUsable && isBotanicalPetalColor(measured.photo_color);
  const speciesColorIsUsable = isBotanicalPetalColor(record?.color);
  const displayColor = photoColorIsUsable ? measured.photo_color : speciesColorIsUsable ? record.color : null;
  const color = flowerColor(displayColor, config.petalBaseColor || config.color);
  const colored = {
    ...config,
    color,
    petalBaseColor: color,
    petalEdgeColor: lighten(color),
    // Species data currently provides one accent, so use the template's center
    // color for anatomically appropriate contrasts (e.g. yellow daisy centers).
  };
  return {
    ...contentFields(record || {}, colored),
    flowerTemplateConfidence: assignment?.confidence ?? 0,
    flowerTemplateFallback: Boolean(fallback),
    flowerTemplateReason: assignment?.reason || 'Chưa có quy tắc hình thái cho loài này.',
    flowerArchetype: template || null,
    flowerDisplayColorSource: photoColorIsUsable ? 'central photo sample' : speciesColorIsUsable ? 'species.json' : 'archetype preset',
    flowerColorNeedsReview: Boolean(hasPhotoColorMismatch),
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
