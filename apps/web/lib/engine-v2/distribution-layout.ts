import { numericDomain, orderedUnique, type NumericDomain } from "./chart-layout.ts";
import type { DeterministicChartDatum } from "./chart-types.ts";

export type ErrorBarDatum = { label: string; value: number; errorLow: number; errorHigh: number; series?: string };
export type DistributionDatum = { value: number; series?: string };

export function finiteErrorBarData(data: DeterministicChartDatum[]): ErrorBarDatum[] {
  return data.flatMap((datum) => "label" in datum && "value" in datum && "errorLow" in datum && "errorHigh" in datum && typeof datum.errorLow === "number" && typeof datum.errorHigh === "number" && Number.isFinite(datum.value) && Number.isFinite(datum.errorLow) && Number.isFinite(datum.errorHigh) && datum.errorLow <= datum.value && datum.value <= datum.errorHigh ? [{ label: datum.label, value: datum.value, errorLow: datum.errorLow, errorHigh: datum.errorHigh, series: "series" in datum && typeof datum.series === "string" ? datum.series : undefined }] : []);
}

export function finiteDistributionData(data: DeterministicChartDatum[]): DistributionDatum[] {
  return data.flatMap((datum) => "value" in datum && !("label" in datum) && Number.isFinite(datum.value) ? [{ value: datum.value, series: "series" in datum && typeof datum.series === "string" ? datum.series : undefined }] : []);
}

export type DensitySeries = { name: string; points: Array<{ value: number; density: number }> };

export function densitySeries(data: DeterministicChartDatum[], sampleCount = 48): { series: DensitySeries[]; valueDomain: NumericDomain; maxDensity: number } {
  const finite = finiteDistributionData(data);
  const names = orderedUnique(finite.map((datum) => datum.series?.trim() || "Value"));
  const valueDomain = numericDomain(finite.map((datum) => datum.value));
  const span = valueDomain.max - valueDomain.min || 1;
  const series = names.map((name) => {
    const values = finite.filter((datum) => (datum.series?.trim() || "Value") === name).map((datum) => datum.value);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length - 1, 1));
    const bandwidth = Math.max(1.06 * deviation * Math.pow(Math.max(values.length, 1), -0.2), span / 1000);
    const points = Array.from({ length: sampleCount }, (_, index) => {
      const value = valueDomain.min + span * index / Math.max(sampleCount - 1, 1);
      const density = values.reduce((sum, sample) => { const z = (value - sample) / bandwidth; return sum + Math.exp(-0.5 * z * z); }, 0) / Math.max(values.length * bandwidth * Math.sqrt(2 * Math.PI), 1);
      return { value, density };
    });
    return { name, points };
  });
  return { series, valueDomain, maxDensity: Math.max(0, ...series.flatMap((entry) => entry.points.map((point) => point.density))) };
}

export function streamLayers(data: DeterministicChartDatum[]) {
  const rows = data.flatMap((datum) => "label" in datum && "value" in datum && typeof datum.value === "number" && Number.isFinite(datum.value) && datum.value >= 0 ? [{ label: datum.label, value: datum.value, series: "series" in datum && typeof datum.series === "string" ? datum.series.trim() || "Value" : "Value" }] : []);
  const labels = orderedUnique(rows.map((datum) => datum.label));
  const series = orderedUnique(rows.map((datum) => datum.series));
  const totals = labels.map((label) => rows.filter((datum) => datum.label === label).reduce((sum, datum) => sum + datum.value, 0));
  const layers = series.map((name) => ({
    name,
    points: labels.map((label, index) => {
      const before = series.slice(0, series.indexOf(name)).reduce((sum, prior) => sum + (rows.find((datum) => datum.label === label && datum.series === prior)?.value ?? 0), 0);
      const value = rows.find((datum) => datum.label === label && datum.series === name)?.value ?? 0;
      const baseline = -totals[index] / 2;
      return { label, start: baseline + before, end: baseline + before + value };
    }),
  }));
  const domain = numericDomain(layers.flatMap((layer) => layer.points.flatMap((point) => [point.start, point.end])));
  return { labels, series, layers, domain };
}
