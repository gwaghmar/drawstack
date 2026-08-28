import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  equirectangularProject,
  geographicChartSvg,
  isRouteMapDatum,
  isSymbolMapDatum,
} from "./geographic-chart.ts";
import { DEFAULT_CHART_PALETTE } from "./chart-types.ts";

describe("geographic charts", () => {
  it("projects latitude and longitude deterministically", () => {
    assert.deepEqual(equirectangularProject(90, -180), { x: 36, y: 22 });
    assert.deepEqual(equirectangularProject(0, 0), { x: 320, y: 154 });
    assert.deepEqual(equirectangularProject(-90, 180), { x: 604, y: 286 });
  });

  it("validates honest geographic contracts", () => {
    assert.equal(isSymbolMapDatum({ label: "Chicago", latitude: 41.8781, longitude: -87.6298, value: 8 }), true);
    assert.equal(isSymbolMapDatum({ label: "Invalid", latitude: 91, longitude: 0 }), false);
    assert.equal(isRouteMapDatum({ label: "Chicago to Tokyo", sourceLatitude: 41.8781, sourceLongitude: -87.6298, targetLatitude: 35.6762, targetLongitude: 139.6503 }), true);
    assert.equal(isRouteMapDatum({ label: "Invalid", sourceLatitude: 0, sourceLongitude: -181, targetLatitude: 0, targetLongitude: 0 }), false);
  });

  it("renders symbols and routes without invented boundaries", () => {
    const symbols = geographicChartSvg({
      type: "symbol-map",
      title: "Offices <global>",
      data: [{ label: "Chicago & HQ", latitude: 41.8781, longitude: -87.6298, value: 8 }],
    }, DEFAULT_CHART_PALETTE);
    assert.match(symbols, /data-map-symbol="0"/);
    assert.match(symbols, /Chicago &amp; HQ/);
    assert.match(symbols, /no boundary dataset/i);
    assert.doesNotMatch(symbols, /<polygon|geojson|country/i);

    const routes = geographicChartSvg({
      type: "route-map",
      title: "Network routes",
      data: [{ label: "ORD to NRT", sourceLatitude: 41.9786, sourceLongitude: -87.9048, targetLatitude: 35.772, targetLongitude: 140.3929, value: 12 }],
    }, DEFAULT_CHART_PALETTE);
    assert.match(routes, /data-map-route="0"/);
    assert.match(routes, /<path d="M/);
    assert.match(routes, /ORD to NRT/);
  });
});
