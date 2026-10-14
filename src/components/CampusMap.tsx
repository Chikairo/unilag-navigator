import { useCallback, useEffect, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  CAMPUS_BOUNDS,
  CAMPUS_CENTER,
  CAMPUS_PLACES,
  type CampusPlace,
  type Coordinate,
} from "../data/places";
import type { RouteResult } from "../lib/routing";

type CampusMapProps = {
  origin: Coordinate;
  destination: CampusPlace | null;
  route: RouteResult | null;
  recenterKey: number;
  tracking: boolean;
  onSelectPlace: (place: CampusPlace) => void;
};

const originIcon = L.divIcon({
  className: "origin-icon-wrap",
  html: '<span class="origin-icon"><span></span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = L.divIcon({
  className: "destination-icon-wrap",
  html: '<span class="destination-icon">B</span>',
  iconSize: [30, 36],
  iconAnchor: [15, 32],
});

function handleTileError(event: L.TileErrorEvent, onFailure: () => void): void {
  const tile = event.tile;
  window.setTimeout(() => {
    if (
      tile.isConnected &&
      tile instanceof HTMLImageElement &&
      tile.complete &&
      tile.naturalWidth === 0
    ) {
      onFailure();
    }
  }, 750);
}

function MapBehavior({
  origin,
  route,
  recenterKey,
  tracking,
  onMissingTiles,
}: Pick<CampusMapProps, "origin" | "route" | "recenterKey" | "tracking"> & {
  onMissingTiles: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const zoomControl = L.control.zoom({ position: "topright" }).addTo(map);
    return () => {
      zoomControl.remove();
    };
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    let checkTimeout: number | undefined;
    const checkTilesAfterZoom = () => {
      window.clearTimeout(checkTimeout);
      checkTimeout = window.setTimeout(() => {
        let hasLoadedTiles = false;
        map.eachLayer((layer) => {
          if (layer instanceof L.TileLayer) {
            hasLoadedTiles ||= Boolean(
              layer.getContainer()?.querySelector("img.leaflet-tile-loaded"),
            );
          }
        });
        if (!hasLoadedTiles) onMissingTiles();
      }, 1_200);
    };

    map.on("zoomend", checkTilesAfterZoom);
    return () => {
      window.clearTimeout(checkTimeout);
      map.off("zoomend", checkTilesAfterZoom);
    };
  }, [map, onMissingTiles]);

  useEffect(() => {
    if (recenterKey > 0) map.flyTo(origin, 18, { duration: 0.8 });
  }, [map, origin, recenterKey]);

  useEffect(() => {
    if (route?.path.length && !tracking) {
      const routePoints = [...route.path, ...route.connectors.flatMap((connector) => connector)];
      map.fitBounds(L.latLngBounds(routePoints), { padding: [56, 56], maxZoom: 18 });
    }
  }, [map, route, tracking]);

  return null;
}

export default function CampusMap({
  origin,
  destination,
  route,
  recenterKey,
  tracking,
  onSelectPlace,
}: CampusMapProps) {
  const [useFallbackTiles, setUseFallbackTiles] = useState(false);
  const enableFallbackTiles = useCallback(() => setUseFallbackTiles(true), []);
  const campusOutline: Coordinate[] = [
    [CAMPUS_BOUNDS.south, CAMPUS_BOUNDS.west],
    [CAMPUS_BOUNDS.south, CAMPUS_BOUNDS.east],
    [CAMPUS_BOUNDS.north, CAMPUS_BOUNDS.east],
    [CAMPUS_BOUNDS.north, CAMPUS_BOUNDS.west],
  ];

  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={16}
      minZoom={14}
      maxZoom={18}
      maxBounds={[
        [CAMPUS_BOUNDS.south - 0.012, CAMPUS_BOUNDS.west - 0.012],
        [CAMPUS_BOUNDS.north + 0.012, CAMPUS_BOUNDS.east + 0.012],
      ]}
      maxBoundsViscosity={0.75}
      zoomControl={false}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      className="campus-map"
    >
      {useFallbackTiles ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          maxNativeZoom={20}
          keepBuffer={4}
          updateWhenIdle
          eventHandlers={{
            tileerror: (event) => handleTileError(event, () => setUseFallbackTiles(true)),
          }}
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={18}
          keepBuffer={4}
          updateWhenIdle
          eventHandlers={{
            tileerror: (event) => handleTileError(event, () => setUseFallbackTiles(true)),
          }}
        />
      )}
      <MapBehavior
        origin={origin}
        route={route}
        recenterKey={recenterKey}
        tracking={tracking}
        onMissingTiles={enableFallbackTiles}
      />
      <Polygon
        positions={campusOutline}
        pathOptions={{
          color: "#86a895",
          weight: 1.5,
          dashArray: "6 7",
          fillColor: "#cadbce",
          fillOpacity: 0.1,
        }}
      />
      {CAMPUS_PLACES.filter((place) => place.id !== destination?.id).map((place) => (
        <CircleMarker
          key={place.id}
          center={place.coordinates}
          radius={4}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: "#698575",
            fillOpacity: 0.95,
          }}
          eventHandlers={{ click: () => onSelectPlace(place) }}
        >
          <Tooltip direction="top" offset={[0, -4]}>{place.name}</Tooltip>
        </CircleMarker>
      ))}
      {route && (
        <>
          <Polyline
            positions={route.path}
            pathOptions={{ color: "#183e32", weight: 8, opacity: 0.15, lineCap: "round" }}
          />
          <Polyline
            positions={route.path}
            pathOptions={{ color: "#237557", weight: 5, opacity: 0.95, lineCap: "round" }}
          />
          {route.connectors.map((connector, index) => (
            <Polyline
              key={`connector-${index}`}
              positions={connector}
              pathOptions={{
                color: "#237557",
                weight: 4,
                opacity: 0.9,
                dashArray: "3 8",
                lineCap: "round",
              }}
            />
          ))}
        </>
      )}
      <Marker position={origin} icon={originIcon}>
        <Tooltip direction="top" offset={[0, -8]}>Your starting point</Tooltip>
      </Marker>
      {destination && <Marker position={destination.coordinates} icon={destinationIcon} />}
    </MapContainer>
  );
}
