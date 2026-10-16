export interface FlowerSpecies {
  id: string;
  name_vi: string;
  name_en: string;
  scientific_name: string;
  family: string;
  origin: string;
  blooming_season: string;
  sunlight: string;
  watering: string;
  soil: string;
  meaning: string;
  description: string;
  care_guide: string;
  category: 'highlight' | 'standard';
  color: string;
  tags: string[];
  image: string;
  gallery_count?: number;
}

export interface GalleryItem {
  id: number;
  path: string;
  label: string;
  species_id: string;
  source: string;
  exists: boolean;
  url: string;
  score?: number;
}

export interface Prediction {
  label: string;
  name_vi?: string;
  name_en?: string;
  score: number;
}

export interface ClassificationResult {
  predictions: Prediction[];
  confident: boolean;
  grad_cam?: string;
  latency_ms: number;
  top_species?: FlowerSpecies;
}

export interface DetectionBox {
  label: string;
  score: number;
  box_xyxy: [number, number, number, number];
}

export interface DetectionResult {
  detections: DetectionBox[];
  summary: Record<string, number>;
  image: string;
  latency_ms: number;
}

export interface RAGSource {
  source: string;
  title?: string;
  text: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  timestamp: string;
}

export interface SystemHealth {
  status: string;
  device: string;
  revision: string | null;
  models: {
    classifier: boolean;
    detector: boolean;
    retrieval: boolean;
    llm: boolean;
  };
  model_states: {
    classifier: string;
    detector: string;
    retrieval: string;
    llm: string;
  };
  dataset_info?: {
    species_count: number;
    gallery_images: number;
    kb_chunks: number;
  };
}
