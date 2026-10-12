import { CAMPUS_BOUNDS, isInsideCampus, type Coordinate } from "../data/places";

type GraphNode = {
  id: string;
  coordinate: Coordinate;
  edges: Array<{ to: string; distance: number }>;
};

type OverpassElement =
  | { type: "node"; id: number; lat: number; lon: number }
  | { type: "way"; id: number; nodes: number[] };

export type RouteResult = {
  path: Coordinate[];
  connectors: [Coordinate, Coordinate][];
  distance: number;
  provider: "OpenRouteService" | "OpenStreetMap paths";
};

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const CAMPUS_QUERY = `[out:json][timeout:20];
way["highway"~"^(footway|pedestrian|path|steps|living_street|service)$"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
(._;>;);
out body;`;
let cachedFootwayGraph: Map<string, GraphNode> | null = null;

function metersBetween([latA, lonA]: Coordinate, [latB, lonB]: Coordinate): number {
  const radians = Math.PI / 180;
  const deltaLat = (latB - latA) * radians;
  const deltaLon = (lonB - lonA) * radians;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA * radians) * Math.cos(latB * radians) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadFootwayGraph(signal: AbortSignal): Promise<Map<string, GraphNode>> {
  if (cachedFootwayGraph) return cachedFootwayGraph;

  let lastError: Error | null = null;
  let data: { elements: OverpassElement[] } | null = null;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(CAMPUS_QUERY)}`,
        signal,
      });
      if (!response.ok) {
        lastError = new Error(`OpenStreetMap paths could not be loaded (${response.status}).`);
        continue;
      }
      data = (await response.json()) as { elements: OverpassElement[] };
      break;
    } catch (error) {
      if (signal.aborted) throw error;
      lastError =
        error instanceof Error
          ? error
          : new Error("OpenStreetMap paths could not be loaded.");
    }
  }
  if (!data) {
    throw lastError ?? new Error("OpenStreetMap paths could not be loaded.");
  }
  const nodes = new Map<string, Coordinate>();
  const ways: number[][] = [];
  for (const element of data.elements) {
    if (element.type === "node") nodes.set(String(element.id), [element.lat, element.lon]);
    if (element.type === "way") ways.push(element.nodes);
  }

  const graph = new Map<string, GraphNode>();
  const getNode = (id: number): GraphNode | undefined => {
    const key = String(id);
    let node = graph.get(key);
    if (!node) {
      const coordinate = nodes.get(key);
      if (!coordinate || !isInsideCampus(coordinate)) return undefined;
      node = { id: key, coordinate, edges: [] };
      graph.set(key, node);
    }
    return node;
  };

  for (const way of ways) {
    for (let index = 1; index < way.length; index += 1) {
      const from = getNode(way[index - 1]);
      const to = getNode(way[index]);
      if (!from || !to) continue;
      const distance = metersBetween(from.coordinate, to.coordinate);
      from.edges.push({ to: to.id, distance });
      to.edges.push({ to: from.id, distance });
    }
  }
  if (graph.size === 0) {
    throw new Error("No walkable paths were found in the campus map data.");
  }
  cachedFootwayGraph = graph;
  return graph;
}

class MinHeap {
  private readonly values: Array<{ id: string; distance: number }> = [];

  push(value: { id: string; distance: number }): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].distance <= value.distance) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): { id: string; distance: number } | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;
    let index = 0;
    while (index * 2 + 1 < this.values.length) {
      let child = index * 2 + 1;
      if (
        child + 1 < this.values.length &&
        this.values[child + 1].distance < this.values[child].distance
      ) {
        child += 1;
      }
      if (this.values[child].distance >= last.distance) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

function nearestNode(graph: Map<string, GraphNode>, coordinate: Coordinate): GraphNode {
  let closest: GraphNode | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const node of graph.values()) {
    const distance = metersBetween(coordinate, node.coordinate);
    if (distance < closestDistance) {
      closest = node;
      closestDistance = distance;
    }
  }
  if (!closest) throw new Error("No walkable paths are available near this location.");
  return closest;
}

function shortestPath(
  graph: Map<string, GraphNode>,
  start: GraphNode,
  end: GraphNode,
): GraphNode[] {
  const distances = new Map([[start.id, 0]]);
  const previous = new Map<string, string>();
  const queue = new MinHeap();
  queue.push({ id: start.id, distance: 0 });

  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === end.id) break;
    for (const edge of graph.get(current.id)?.edges ?? []) {
      const distance = current.distance + edge.distance;
      if (distance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.to, distance);
      previous.set(edge.to, current.id);
      queue.push({ id: edge.to, distance });
    }
  }

  if (!distances.has(end.id)) {
    throw new Error("No connected walking route was found. Try another campus destination.");
  }
  const route: GraphNode[] = [end];
  let current = end.id;
  while (current !== start.id) {
    const parent = previous.get(current);
    if (!parent) throw new Error("The walking route could not be reconstructed.");
    current = parent;
    const node = graph.get(current);
    if (!node) throw new Error("The walking route contains a missing map point.");
    route.unshift(node);
  }
  return route;
}

async function routeOnOpenStreetMap(
  start: Coordinate,
  end: Coordinate,
  signal: AbortSignal,
): Promise<RouteResult> {
  const graph = await loadFootwayGraph(signal);
  const snappedStart = nearestNode(graph, start);
  const snappedEnd = nearestNode(graph, end);
  const startConnectorLength = metersBetween(start, snappedStart.coordinate);
  const endConnectorLength = metersBetween(end, snappedEnd.coordinate);
  if (startConnectorLength > 150 || endConnectorLength > 150) {
    throw new Error("A nearby walkable path could not be found for this location.");
  }
  const nodes = shortestPath(graph, snappedStart, snappedEnd);
  const path = nodes.map((node) => node.coordinate);
  const connectors: [Coordinate, Coordinate][] = [];
  if (metersBetween(start, snappedStart.coordinate) > 2) {
    connectors.push([start, snappedStart.coordinate]);
  }
  if (metersBetween(end, snappedEnd.coordinate) > 2) {
    connectors.push([snappedEnd.coordinate, end]);
  }
  const networkDistance = nodes.reduce(
    (total, node, index) =>
      index === 0 ? total : total + metersBetween(nodes[index - 1].coordinate, node.coordinate),
    0,
  );
  return {
    path,
    connectors,
    distance:
      networkDistance +
      connectors.reduce((total, [from, to]) => total + metersBetween(from, to), 0),
    provider: "OpenStreetMap paths",
  };
}

async function routeOnOpenRouteService(
  start: Coordinate,
  end: Coordinate,
  apiKey: string,
  signal: AbortSignal,
): Promise<RouteResult> {
  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [start[1], start[0]],
          [end[1], end[0]],
        ],
        preference: "shortest",
      }),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`OpenRouteService could not calculate a route (${response.status}).`);
  }
  const data = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates: [number, number][] };
      properties?: { summary?: { distance?: number } };
    }>;
  };
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    throw new Error("OpenRouteService returned an empty walking route.");
  }
  if (coordinates.some(([longitude, latitude]) => !isInsideCampus([latitude, longitude]))) {
    throw new Error("The route leaves the UNILAG campus area. Choose another campus destination.");
  }
  const path = coordinates.map(([longitude, latitude]) => [latitude, longitude] as Coordinate);
  const connectors: [Coordinate, Coordinate][] = [];
  const routeStart = path[0];
  const routeEnd = path[path.length - 1];
  const startConnectorLength = metersBetween(start, routeStart);
  const endConnectorLength = metersBetween(routeEnd, end);
  if (startConnectorLength > 150 || endConnectorLength > 150) {
    throw new Error("The route could not connect to the exact start or destination.");
  }
  if (startConnectorLength > 2) connectors.push([start, routeStart]);
  if (endConnectorLength > 2) connectors.push([routeEnd, end]);
  const networkDistance =
    feature.properties?.summary?.distance ??
    coordinates.slice(1).reduce(
      (total, point, index) =>
        total +
        metersBetween(
          [coordinates[index][1], coordinates[index][0]],
          [point[1], point[0]],
        ),
      0,
    );
  return {
    path,
    connectors,
    distance: networkDistance + startConnectorLength + endConnectorLength,
    provider: "OpenRouteService",
  };
}

export async function findWalkingRoute(
  start: Coordinate,
  end: Coordinate,
  signal: AbortSignal,
): Promise<RouteResult> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY?.trim();
  return apiKey
    ? routeOnOpenRouteService(start, end, apiKey, signal)
    : routeOnOpenStreetMap(start, end, signal);
}

export function distanceBetween(first: Coordinate, second: Coordinate): number {
  return metersBetween(first, second);
}
