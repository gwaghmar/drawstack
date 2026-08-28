import type {
  DeterministicChartPalette,
  DeterministicChartSpec,
  RouteMapDatum,
  SymbolMapDatum,
} from "./chart-types.ts";

export type GeographicPoint = { x: number; y: number };

const VIEWBOX = { width: 640, height: 330 };
const MAP = { left: 36, top: 22, right: 604, bottom: 286 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validValue(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function isSymbolMapDatum(value: unknown): value is SymbolMapDatum {
  return isRecord(value)
    && typeof value.label === "string"
    && value.label.length > 0
    && validCoordinate(value.latitude, -90, 90)
    && validCoordinate(value.longitude, -180, 180)
    && validValue(value.value)
    && (value.series === undefined || typeof value.series === "string");
}

export function isRouteMapDatum(value: unknown): value is RouteMapDatum {
  return isRecord(value)
    && typeof value.label === "string"
    && value.label.length > 0
    && validCoordinate(value.sourceLatitude, -90, 90)
    && validCoordinate(value.sourceLongitude, -180, 180)
    && validCoordinate(value.targetLatitude, -90, 90)
    && validCoordinate(value.targetLongitude, -180, 180)
    && validValue(value.value)
    && (value.series === undefined || typeof value.series === "string");
}

export function equirectangularProject(
  latitude: number,
  longitude: number,
  bounds = MAP,
): GeographicPoint {
  return {
    x: bounds.left + ((longitude + 180) / 360) * (bounds.right - bounds.left),
    y: bounds.top + ((90 - latitude) / 180) * (bounds.bottom - bounds.top),
  };
}

function escapeMarkup(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizedSize(value: number | undefined, values: number[], min: number, max: number): number {
  if (value === undefined || values.length === 0) return min;
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return (min + max) / 2;
  return min + Math.sqrt((value - low) / (high - low)) * (max - min);
}

function graticule(palette: DeterministicChartPalette): string {
  const longitudeLines = [-180, -120, -60, 0, 60, 120, 180].map((longitude) => {
    const { x } = equirectangularProject(0, longitude);
    return `<line x1="${number(x)}" y1="${MAP.top}" x2="${number(x)}" y2="${MAP.bottom}" stroke="${escapeMarkup(palette.grid)}" stroke-width="1"/><text x="${number(x)}" y="${MAP.bottom + 14}" text-anchor="middle" font-size="9" fill="${escapeMarkup(palette.muted)}">${longitude === 0 ? "0°" : `${Math.abs(longitude)}°${longitude < 0 ? "W" : "E"}`}</text>`;
  }).join("");
  const latitudeLines = [-90, -60, -30, 0, 30, 60, 90].map((latitude) => {
    const { y } = equirectangularProject(latitude, 0);
    return `<line x1="${MAP.left}" y1="${number(y)}" x2="${MAP.right}" y2="${number(y)}" stroke="${escapeMarkup(palette.grid)}" stroke-width="1"/><text x="${MAP.left - 5}" y="${number(y + 3)}" text-anchor="end" font-size="9" fill="${escapeMarkup(palette.muted)}">${latitude === 0 ? "0°" : `${Math.abs(latitude)}°${latitude < 0 ? "S" : "N"}`}</text>`;
  }).join("");
  return `<rect x="${MAP.left}" y="${MAP.top}" width="${MAP.right - MAP.left}" height="${MAP.bottom - MAP.top}" rx="8" fill="${escapeMarkup(palette.surface)}" stroke="${escapeMarkup(palette.grid)}"/>${longitudeLines}${latitudeLines}`;
}

function symbolMapMarks(spec: DeterministicChartSpec, palette: DeterministicChartPalette): string {
  const data = spec.data.filter(isSymbolMapDatum);
  const values = data.flatMap((datum) => datum.value === undefined ? [] : [datum.value]);
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Locations"));
  return data.map((datum, index) => {
    const point = equirectangularProject(datum.latitude, datum.longitude);
    const radius = normalizedSize(datum.value, values, 5, 15);
    const color = palette.series[Math.max(series.indexOf(datum.series?.trim() || "Locations"), 0) % palette.series.length];
    const placeLeft = point.x > MAP.right - 90;
    const textX = point.x + (placeLeft ? -radius - 5 : radius + 5);
    const title = `${datum.label}: ${datum.latitude}, ${datum.longitude}${datum.value === undefined ? "" : `, ${datum.value}`}`;
    return `<g data-map-symbol="${index}"><circle cx="${number(point.x)}" cy="${number(point.y)}" r="${number(radius)}" fill="${escapeMarkup(color)}" fill-opacity=".78" stroke="${escapeMarkup(palette.surface)}" stroke-width="2"><title>${escapeMarkup(title)}</title></circle><text x="${number(textX)}" y="${number(point.y + 4)}" text-anchor="${placeLeft ? "end" : "start"}" font-size="10" font-weight="600" fill="${escapeMarkup(palette.foreground)}">${escapeMarkup(datum.label)}</text></g>`;
  }).join("");
}

function routeMapMarks(spec: DeterministicChartSpec, palette: DeterministicChartPalette): string {
  const data = spec.data.filter(isRouteMapDatum);
  const values = data.flatMap((datum) => datum.value === undefined ? [] : [datum.value]);
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Routes"));
  return data.map((datum, index) => {
    const source = equirectangularProject(datum.sourceLatitude, datum.sourceLongitude);
    const target = equirectangularProject(datum.targetLatitude, datum.targetLongitude);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    const bend = Math.min(distance * 0.16, 42);
    const controlX = (source.x + target.x) / 2 - (distance ? dy / distance * bend : 0);
    const controlY = (source.y + target.y) / 2 + (distance ? dx / distance * bend : 0);
    const color = palette.series[Math.max(series.indexOf(datum.series?.trim() || "Routes"), 0) % palette.series.length];
    const strokeWidth = normalizedSize(datum.value, values, 2, 6);
    const title = `${datum.label}: ${datum.sourceLatitude}, ${datum.sourceLongitude} to ${datum.targetLatitude}, ${datum.targetLongitude}${datum.value === undefined ? "" : `, ${datum.value}`}`;
    return `<g data-map-route="${index}"><path d="M${number(source.x)},${number(source.y)} Q${number(controlX)},${number(controlY)} ${number(target.x)},${number(target.y)}" fill="none" stroke="${escapeMarkup(color)}" stroke-width="${number(strokeWidth)}" stroke-linecap="round" stroke-opacity=".82"><title>${escapeMarkup(title)}</title></path><circle cx="${number(source.x)}" cy="${number(source.y)}" r="4" fill="${escapeMarkup(palette.surface)}" stroke="${escapeMarkup(color)}" stroke-width="2"/><circle cx="${number(target.x)}" cy="${number(target.y)}" r="5" fill="${escapeMarkup(color)}" stroke="${escapeMarkup(palette.surface)}" stroke-width="2"/><text x="${number((source.x + target.x) / 2)}" y="${number((source.y + target.y) / 2 - 7)}" text-anchor="middle" font-size="10" font-weight="600" fill="${escapeMarkup(palette.foreground)}">${escapeMarkup(datum.label)}</text></g>`;
  }).join("");
}

export function geographicChartSvg(spec: DeterministicChartSpec, palette: DeterministicChartPalette): string {
  const isRoute = spec.type === "route-map";
  const data = isRoute ? spec.data.filter(isRouteMapDatum) : spec.data.filter(isSymbolMapDatum);
  const title = `${spec.title}, ${spec.type} chart`;
  const empty = `<text x="320" y="165" text-anchor="middle" font-size="13" fill="${escapeMarkup(palette.muted)}">No valid geographic coordinates</text>`;
  const marks = data.length === 0 ? empty : isRoute ? routeMapMarks(spec, palette) : symbolMapMarks(spec, palette);
  return `<svg class="engine-chart" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" role="img" aria-label="${escapeMarkup(title)}"><title>${escapeMarkup(spec.title)}</title><desc>Equirectangular coordinate grid only. No geographic boundary dataset is included.</desc>${graticule(palette)}${marks}<text x="604" y="321" text-anchor="end" font-size="9" fill="${escapeMarkup(palette.muted)}">Equirectangular · coordinate grid only · no boundary dataset</text></svg>`;
}
