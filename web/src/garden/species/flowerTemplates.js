import { daisyConfig } from './daisy.config.js';
import defaults from '../../../../data/flower_template_defaults.json';

const entries = Object.entries(defaults).map(([id, value]) => ({ id, ...value }));
export const flowerTemplatePresets = entries.filter((item) => item.phase === 1);
export const supplementalFlowerTemplates = entries.filter((item) => item.phase > 1);
const allTemplatePresets = entries;

function distributePetals(petalCount, layerCount) {
  const counts = Array.from({ length: layerCount }, () => Math.floor(petalCount / layerCount));
  for (let i = 0; i < petalCount % layerCount; i += 1) counts[i] += 1;
  return counts;
}

export function createTemplateConfig(templateId, overrides = {}) {
  const preset = allTemplatePresets.find((item) => item.id === templateId);
  if (!preset) throw new Error(`Unknown flower template: ${templateId}`);
  // Keep the accepted daisy geometry and measurements unchanged for the reference view.
  if (templateId === 'disk' && Object.keys(overrides).length === 0) return daisyConfig;

  const params = { ...preset.params, ...overrides };
  const counts = distributePetals(params.petalCount, params.layerCount);
  const id = templateId === 'disk' ? 'daisy' : `template-${templateId}`;
  const layers = counts.map((count, index) => {
    const progress = params.layerCount <= 1 ? 0 : index / (params.layerCount - 1);
    return {
      count, length: params.petalLength * (1 - progress * 0.28), width: params.petalWidth * (1 - progress * 0.12),
      curl: params.curvature,
      pitch: templateId === 'bowl' ? -0.6 : templateId === 'bell' ? 0.1 : templateId === 'star' ? 0.08 : -0.08 - progress * 0.13,
      color: '#ffffff', phase: index * 0.22, delay: index * 0.06,
    };
  });
  return {
    id, template: templateId, nameVi: preset.label, scientificName: '',
    color: params.petalColor, petalBaseColor: params.petalColor, petalEdgeColor: params.edgeColor,
    undersideColor: params.undersideColor, center: params.centerColor, centerRadius: params.centerSize,
    centerScaleY: templateId === 'cluster' || templateId === 'spike' ? 1 : 0.72, centerY: 0.02,
    budRadius: templateId === 'cluster' ? 0.12 : templateId === 'spike' ? 0.045 : 0.19,
    floretCount: params.floretCount, clusterRadius: templateId === 'spike' ? 0.43 : undefined,
    headY: 0.92 + params.stemLength, headScale: 1, headLeanX: -0.04,
    shape: preset.kind, tipShape: params.tip, curl: params.curvature,
    leaves: params.leafCount, leafLength: templateId === 'disk' ? 0.54 : 0.72,
    leafWidth: templateId === 'disk' ? 0.16 : 0.19, leafLobes: templateId === 'disk',
    leaf: params.leafColor, stem: '#66825d', stemRadius: 0.04, bend: -0.08,
    open: 0, wave: templateId === 'layered' ? 0.05 : 0.018, layers,
    seedCount: templateId === 'disk' ? 140 : templateId === 'cluster' ? 28 : 0,
    seedSize: templateId === 'disk' ? 0.008 : 0.013, seedColor: '#b87935',
  };
}
