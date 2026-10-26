export interface SlideStatusInfo {
  label: string;
  cssClass: string;
  desc: string;
}

export interface RiskItem {
  id: string;
  title: string;
  cat: string;
  prob: number;
  impact: number;
  mitigation: string;
  owner: string;
}

export interface KpiItem {
  code: string;
  name: string;
  unit: string;
  cadence: string;
  formula: string;
  targetPilot: string;
}

export interface SlideMetaItem {
  order: number;
  id: string;
  category: string;
  title: string;
  subtitle: string;
  dataStatus: string;
  takeaway: string;
  source: string;
  notes: string;
}

export const DATA_STATUS_META: Record<string, SlideStatusInfo>;
export const RISKS_11: RiskItem[];
export const KPIS_13: KpiItem[];
export const SLIDES_META: SlideMetaItem[];
