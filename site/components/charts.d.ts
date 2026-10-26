export function faNum(val: number | string): string;
export function faMillion(toman: number): string;
export function renderForecastTrendSvg(scenario: { months: Array<Record<string, number>> }): string;
export function renderScenarioBarsSvg(scenarios: Record<string, unknown>): string;
export function renderSensitivityTornadoSvg(sensitivity: Record<string, unknown>): string;
export function renderCompetitorMatrixSvg(): string;
export function renderAcquisitionFunnelSvg(): string;
export function renderRiskMatrixSvg(risks: Array<any>, selectedId?: string): string;
