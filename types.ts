export type Config = {
  server: string;
  village: {
    x: number;
    y: number;
  };
  searchRadius: number;
  negativeQuadrantOnly: boolean;
  types: number[];
  competitionTypes: number[];
  oasisRadius: number;
  maxOases: number;
  minPotentialCropBonus: number;
  preferredUncontestedCropBonus: number;
  lowRiskCompetitorPotentialMax: number;
  downloadReport: boolean;
};

export type Oasis = {
  x: number;
  y: number;
  distance: number;
  cropBonus: number;
  occupied: boolean;
};

export type CropperClash = {
  x: number;
  y: number;
  size: string;
  distance: number;
  oasisCropPotential: number;
  risk: 'low' | 'high';
  sharedOases: Pick<Oasis, 'x' | 'y' | 'cropBonus'>[];
};

export type Village = {
  x: number;
  y: number;
  distance: number;
  size: string;
  oasisCropBonus: number;
  uncontestedOasisCropBonus: number;
  oasisCropPotential: number;
  oases: Oasis[];
  recommendedOases: Oasis[];
  competingCroppers: CropperClash[];
  hasOasisClash: boolean;
  oasisClashRisk: 'none' | 'low' | 'high';
  rank: number;
};
