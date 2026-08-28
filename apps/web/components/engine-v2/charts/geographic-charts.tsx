import { geographicChartSvg } from "@/lib/engine-v2/geographic-chart";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

export function GeographicChart({
  spec,
  palette,
}: {
  spec: DeterministicChartSpec;
  palette: DeterministicChartPalette;
}) {
  return <div dangerouslySetInnerHTML={{ __html: geographicChartSvg(spec, palette) }} />;
}
