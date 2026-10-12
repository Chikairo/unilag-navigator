import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import CampusMap from "./components/CampusMap";
import {
  CAMPUS_CENTER,
  CAMPUS_PLACES,
  isInsideCampus,
  type CampusPlace,
  type Coordinate,
} from "./data/places";
import { createPlaceSearch } from "./lib/placeSearch";
import { searchOpenStreetMap } from "./lib/osmSearch";
import { distanceBetween, findWalkingRoute, type RouteResult } from "./lib/routing";

export default function App() {
  const [origin, setOrigin] = useState<Coordinate>(CAMPUS_CENTER);
  const [destination, setDestination] = useState<CampusPlace | null>(null);
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [hasCurrentLocation, setHasCurrentLocation] = useState(false);
  const [osmSearchResults, setOsmSearchResults] = useState<CampusPlace[]>([]);
  const [osmSearchLoading, setOsmSearchLoading] = useState(false);
  const [osmSearchError, setOsmSearchError] = useState("");
  const [recenterKey, setRecenterKey] = useState(0);
  const lastRouted = useRef<{ origin: Coordinate; destinationId: string } | null>(null);
  const lastGpsUpdate = useRef<Coordinate | null>(null);
  const osmSearchController = useRef<AbortController | null>(null);
  const searchPlaces = useMemo(() => createPlaceSearch(CAMPUS_PLACES), []);
  const suggestions = useMemo(() => {
    const local = searchPlaces(query);
    const localIds = new Set(local.map((place) => `${place.osmType}-${place.osmId}`));
    const additional = osmSearchResults.filter(
      (place) => !localIds.has(`${place.osmType}-${place.osmId}`),
    );
    return [...local, ...additional].slice(0, 10);
  }, [osmSearchResults, query, searchPlaces]);

  useEffect(() => {
    if (!destination) {
      setRoute(null);
      setRouteError("");
      setRouteLoading(false);
      lastRouted.current = null;
      return;
    }
    if (!isInsideCampus(origin)) {
      setRoute(null);
      setRouteError("You’re outside the campus area. Routes are available within UNILAG only.");
      setRouteLoading(false);
      lastRouted.current = null;
      return;
    }
    const previous = lastRouted.current;
    if (
      previous?.destinationId === destination.id &&
      distanceBetween(previous.origin, origin) < 20
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      lastRouted.current = { origin, destinationId: destination.id };
      setRouteLoading(true);
      setRouteError("");
      void findWalkingRoute(origin, destination.coordinates, controller.signal)
        .then((result) => {
          setRoute(result);
          setRouteError("");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRoute(null);
          setRouteError(
            error instanceof Error ? error.message : "The walking route could not be calculated.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setRouteLoading(false);
        });
    }, tracking ? 500 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destination, origin, tracking]);

  useEffect(() => {
    if (!tracking) return;
    if (!navigator.geolocation) {
      setLocationMessage("This browser does not support location services.");
      setTracking(false);
      return;
    }
    setLocating(true);
    setLocationMessage("");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const current: Coordinate = [position.coords.latitude, position.coords.longitude];
        const previous = lastGpsUpdate.current;
        if (previous && distanceBetween(previous, current) < 25) return;
        lastGpsUpdate.current = current;
        setOrigin(current);
        setHasCurrentLocation(true);
        setLocating(false);
        setLocationMessage(
          isInsideCampus(current)
            ? "Live location is on"
            : "You’re outside the UNILAG campus route area",
        );
        setRecenterKey((key) => key + 1);
      },
      (error) => {
        setLocating(false);
        setTracking(false);
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Enable it in your browser to use live location."
            : "Your location could not be determined. Please try again.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  const chooseDestination = (place: CampusPlace) => {
    setDestination(place);
    setQuery("");
    setRouteError("");
  };

  const searchAllMappedPlaces = () => {
    const searchQuery = query.trim();
    if (!searchQuery || osmSearchLoading) return;
    osmSearchController.current?.abort();
    const controller = new AbortController();
    osmSearchController.current = controller;
    setOsmSearchResults([]);
    setOsmSearchError("");
    setOsmSearchLoading(true);
    void searchOpenStreetMap(searchQuery, controller.signal)
      .then((places) => {
        setOsmSearchResults(places);
        if (places.length === 0) {
          setOsmSearchError("No mapped places with that name were found inside the campus boundary.");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOsmSearchError(
          error instanceof Error ? error.message : "OpenStreetMap place search failed.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setOsmSearchLoading(false);
      });
  };

  const toggleTracking = () => {
    if (tracking) {
      setTracking(false);
      setLocating(false);
      setLocationMessage("Live location paused");
      return;
    }
    setTracking(true);
  };

  const distanceLabel = route
    ? route.distance >= 1_000
      ? `${(route.distance / 1_000).toFixed(1)} km`
      : `${Math.round(route.distance / 10) * 10} m`
    : null;
  const minutes = route ? Math.max(1, Math.round(route.distance / 75)) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Unilag Navigator home">
          <span className="brand-mark"><Navigation size={19} strokeWidth={2.3} /></span>
          <span className="brand-name">unilag<span>go</span></span>
        </a>
        <div className="topbar-right">
          <span className="campus-pill"><span className="status-dot" /> UNILAG CAMPUS</span>
          <span className="topbar-divider" />
          <span className="topbar-caption">Made for getting there</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-content">
            <div className="eyebrow"><span /> CAMPUS WALKING GUIDE</div>
            <h1>Your next stop,<br />without the guesswork.</h1>
            <p className="intro-copy">
              Find the shortest walk between places at the University of Lagos.
            </p>

            <section className="planner-card" aria-label="Plan a campus route">
              <div className="route-fields">
                <div className="field-icon-column" aria-hidden="true">
                  <span className="origin-field-dot" />
                  <span className="field-connector" />
                  <span className="destination-field-pin"><MapPin size={14} /></span>
                </div>
                <div className="fields">
                  <div className="location-field origin-field">
                    <span className="field-label">STARTING FROM</span>
                    <div className="field-value-row">
                      <span>{hasCurrentLocation ? "Your current location" : "UNILAG campus centre"}</span>
                      {!hasCurrentLocation && <span className="sample-tag">MAP CENTRE</span>}
                    </div>
                  </div>
                  <div className="field-rule" />
                  <div className="destination-field">
                    <label className="field-label" htmlFor="destination-search">GOING TO</label>
                    <div className="search-input-wrap">
                      <Search size={17} className="search-icon" aria-hidden="true" />
                      <input
                        id="destination-search"
                        value={destination ? destination.name : query}
                        onChange={(event) => {
                          osmSearchController.current?.abort();
                          setDestination(null);
                          setQuery(event.target.value);
                          setOsmSearchResults([]);
                          setOsmSearchError("");
                          setOsmSearchLoading(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            searchAllMappedPlaces();
                          }
                        }}
                        onFocus={() => {
                          if (destination) {
                            setQuery("");
                            setDestination(null);
                          }
                        }}
                        placeholder="Search a campus destination"
                        autoComplete="off"
                      />
                      {(query || destination) && (
                        <button
                          className="clear-search"
                          aria-label="Clear destination"
                          onClick={() => {
                            setDestination(null);
                            setQuery("");
                          }}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {query && (
                <div className="suggestion-list" role="listbox" aria-label="Campus destinations">
                  {suggestions.length ? (
                    suggestions.map((place) => (
                      <button
                        className="suggestion"
                        key={place.id}
                        role="option"
                        aria-selected={destination?.id === place.id}
                        onClick={() => chooseDestination(place)}
                      >
                        <span className="suggestion-pin"><MapPin size={15} /></span>
                        <span className="suggestion-text">
                          <strong>{place.name}</strong>
                          <small>{place.category}</small>
                        </span>
                        <ArrowUpRight size={16} className="suggestion-arrow" />
                      </button>
                    ))
                  ) : !osmSearchLoading && !osmSearchError ? (
                    <div className="no-results">
                      <strong>No quick-search match</strong>
                      <span>Press Enter or search OpenStreetMap to find mapped campus places.</span>
                    </div>
                  ) : null}
                  {osmSearchLoading && (
                    <div className="osm-search-status" role="status">
                      <span className="loading-spinner" /> Searching mapped campus places…
                    </div>
                  )}
                  {osmSearchError && !osmSearchLoading && (
                    <div className="osm-search-error" role="status">{osmSearchError}</div>
                  )}
                  <button
                    className="osm-search-button"
                    disabled={osmSearchLoading}
                    onClick={searchAllMappedPlaces}
                  >
                    {osmSearchLoading ? "Searching OpenStreetMap…" : `Search OpenStreetMap for “${query}”`}
                  </button>
                </div>
              )}

              <button
                className={`location-button${tracking ? " is-active" : ""}`}
                onClick={toggleTracking}
                disabled={locating}
              >
                <LocateFixed size={16} />
                <span>{locating ? "Finding your location…" : tracking ? "Pause live location" : "Use my current location"}</span>
                {!tracking && <span className="button-shortcut">GPS</span>}
              </button>
            </section>

            {(locationMessage || routeError) && (
              <div className={`inline-message${routeError ? " is-error" : ""}`} role="status">
                <span className="message-dot" />
                <span>{routeError || locationMessage}</span>
              </div>
            )}

            {destination ? (
              <section className="route-summary" aria-live="polite">
                <div className="summary-heading">
                  <div>
                    <span className="section-kicker">YOUR WALK</span>
                    <h2>{destination.name}</h2>
                  </div>
                  {route && (
                    <button
                      className="remove-route"
                      aria-label="Clear route"
                      onClick={() => {
                        setDestination(null);
                        setRoute(null);
                      }}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                {routeLoading && !route ? (
                  <div className="route-loading"><span className="loading-spinner" /> Finding walkable paths…</div>
                ) : route ? (
                  <>
                    <div className="route-stats">
                      <div className="route-stat">
                        <strong>{distanceLabel}</strong>
                        <span>walking distance</span>
                      </div>
                      <span className="stat-divider" />
                      <div className="route-stat">
                        <strong>~{minutes} min</strong>
                        <span>at an easy pace</span>
                      </div>
                    </div>
                    <div className="route-meta">
                      <span className="route-line-key" />
                      <span>{routeLoading ? "Updating as you move" : "Walkable campus paths"}</span>
                      <span className="route-provider">{route.provider}</span>
                    </div>
                  </>
                ) : routeLoading ? (
                  <div className="route-loading"><span className="loading-spinner" /> Finding walkable paths…</div>
                ) : null}
              </section>
            ) : (
              <section className="popular-section">
                <div className="section-title-row">
                  <span className="section-kicker">POPULAR DESTINATIONS</span>
                  <ArrowDown size={14} />
                </div>
                <div className="popular-list">
                  {CAMPUS_PLACES.slice(1, 5).map((place, index) => (
                    <button className="popular-place" key={place.id} onClick={() => chooseDestination(place)}>
                      <span className={`popular-number number-${index + 1}`}>0{index + 1}</span>
                      <span>{place.name}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="privacy-note">
              <ShieldCheck size={15} />
              <span>Your location stays on your device.</span>
            </div>
          </div>
          <footer className="sidebar-footer">
            <span>UNIVERSITY OF LAGOS</span>
            <span>AKOKA · LAGOS</span>
          </footer>
        </aside>

        <section className="map-panel" aria-label="Map of University of Lagos campus">
          <CampusMap
            origin={origin}
            destination={destination}
            route={route}
            recenterKey={recenterKey}
            onSelectPlace={chooseDestination}
          />
          <div className="map-top-label">
            <span className="map-label-dot" />
            <span>AKOKA CAMPUS</span>
            <span className="map-label-divider" />
            <span>UNIVERSITY OF LAGOS</span>
          </div>
          <button
            className="recenter-button"
            title="Center map on your location"
            aria-label="Center map on your location"
            onClick={() => setRecenterKey((key) => key + 1)}
          >
            <LocateFixed size={18} />
          </button>
          <div className="map-legend">
            <span><i className="legend-origin" /> You are here</span>
            <span><i className="legend-route" /> Walking route</span>
            <span><i className="legend-connector" /> Final connector</span>
          </div>
          <div className="map-credit">Campus routes · OpenStreetMap</div>
        </section>
      </section>
    </main>
  );
}
