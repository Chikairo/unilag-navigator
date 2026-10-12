import {
  CAMPUS_BOUNDS,
  isInsideCampus,
  type CampusPlace,
  type Coordinate,
} from "../data/places";

type NominatimResult = {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
};

let lastSearchStartedAt = 0;

function categoryLabel(category: string | undefined, type: string | undefined): string {
  const kind = type?.replace(/_/g, " ");
  if (category === "amenity" && kind) return kind[0].toUpperCase() + kind.slice(1);
  if (category === "building") return "Building";
  if (category === "office") return "Office";
  if (category === "leisure" && kind) return kind[0].toUpperCase() + kind.slice(1);
  return "Campus place";
}

export async function searchOpenStreetMap(
  query: string,
  signal: AbortSignal,
): Promise<CampusPlace[]> {
  const wait = Math.max(0, 1_000 - (Date.now() - lastSearchStartedAt));
  if (wait) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, wait));
  }
  if (signal.aborted) throw new DOMException("Search cancelled.", "AbortError");
  lastSearchStartedAt = Date.now();

  const parameters = new URLSearchParams({
    format: "jsonv2",
    limit: "10",
    bounded: "1",
    viewbox: [
      CAMPUS_BOUNDS.west,
      CAMPUS_BOUNDS.north,
      CAMPUS_BOUNDS.east,
      CAMPUS_BOUNDS.south,
    ].join(","),
    q: query,
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OpenStreetMap place search failed (${response.status}).`);
  }

  const results = (await response.json()) as NominatimResult[];
  return results.flatMap((result) => {
    const coordinate: Coordinate = [Number(result.lat), Number(result.lon)];
    if (
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1]) ||
      !isInsideCampus(coordinate)
    ) {
      return [];
    }
    const name = result.name?.trim() || result.display_name.split(",")[0]?.trim();
    if (!name) return [];
    return [{
      id: `osm-${result.osm_type}-${result.osm_id}`,
      name,
      category: categoryLabel(result.category, result.type),
      coordinates: coordinate,
      aliases: [],
      osmType: result.osm_type,
      osmId: result.osm_id,
    }];
  });
}
