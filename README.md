# UNILAG Go

A React, TypeScript, Leaflet campus walking navigator for the University of Lagos.

## Start locally

```sh
npm.cmd install
npm.cmd run dev
```

To open the development site on a phone connected to the same Wi-Fi, use the
computer's local network address with port `5173` (for example,
`http://192.168.1.20:5173`). The development server listens on the network;
Windows Firewall may ask permission the first time.

The map uses OpenStreetMap tiles and OSM campus bounds, with CARTO tiles as a
fallback if the primary tiles fail. Zoom controls support close inspection
through native zoom level 18, avoiding blank tiles beyond the base map's
available detail. The map invalidates its size when the layout changes. Search includes named
campus features currently mapped in OpenStreetMap, common abbreviations, and
typo-tolerant matching. If a place is missing from the curated list, type its
name and use **Search OpenStreetMap** to look up mapped features within the
campus bounds. This lookup is explicit (not per-keystroke autocomplete) and
uses OpenStreetMap's Nominatim service. Until geolocation is enabled, the start
is the mapped University of Lagos campus point, not a simulated Main Gate
location. Choose **Use my current location** to share browser geolocation and
keep the starting point updated as you walk.

Each curated destination includes its OpenStreetMap object type and ID in
`src/data/places.ts`. Places that could not be verified as named OSM features
were removed rather than left at guessed coordinates. Some OSM coordinates
represent the centre of a mapped building or area, not its entrance; dashed
connectors show the final straight-line link and should be checked against
on-campus access paths. The campus-only search can only find places present in
OpenStreetMap; unmapped campus buildings need their locations added to OSM or
verified from another authoritative campus source.

Engineering, Science, Law, Arts, Management Sciences, King Jaja Hall, and
Mariere Hall have local entries using their named OpenStreetMap features, so
they appear immediately in search. Their common campus abbreviations are
supported; an exact abbreviation match is returned ahead of typo suggestions.

## Walking routes

Set `VITE_ORS_API_KEY` in a local `.env` file to use OpenRouteService's
`foot-walking` profile with shortest-distance preference. Without a key, the app
loads OSM pedestrian ways from Overpass and finds the shortest connected path
with Dijkstra's algorithm. Dashed connectors join the selected start and
destination to the route when a routing service's path does not end at the
selected point. Routes are limited to the campus bounds in `src/data/places.ts`.

The fallback asks Overpass for `footway`, `pedestrian`, `path`, and other
walkable highway types in the campus area. Overpass availability and OSM map
coverage vary; route failures are surfaced in the interface rather than
presented as a successful route.

## Build

```sh
npm.cmd run build
```
