export interface CatScores {
  demolition: number;
  clingy: number;
  shedding: number;
  cost: number;
  looks: number;
}

export interface CatBreed {
  id: string;
  name_zh: string;
  name_en: string;
  origin: string;
  size: string;
  coat: string;
  quote: string;
  meme_tags: string[];
  suitable_owners: string[];
  image_url: string;
  scores: CatScores;
}

export interface DailyCatResponse {
  breed: CatBreed;
  date: string;
  is_daily: boolean;
}
