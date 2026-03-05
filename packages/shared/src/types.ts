export type Citation = {
  title: string;
  url: string;
  accessed_on: string;
};

export type EmissionFactor = {
  id: string;
  activity: string;
  unit: string;
  factor_kg_co2e_per_unit: number;
  region: string;
  citations: Citation[];
};

export type BenchmarkStat = {
  id: string;
  category: string;
  metric: string;
  unit: string;
  value: number;
  citations: Citation[];
};

export type FactTemplate = {
  id: string;
  template: string;
  tags: string[];
  citations: Citation[];
};
