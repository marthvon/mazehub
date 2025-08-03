# Mazehub Component Library

**Author:** marthvon \<mamertvonn@gmail.com>

Modern React Integration of Mazemap Package

Package of Frontend Components using React <u>></u> 18.

# Installation Guide

``` bash
npm install tailwindcss postcss postcss-import autoprefixer --save-dev
npm install @marthvon/mazehub
```

# Configuration Setup

## Setup Tailwind

> tailwind.config.js
``` javascript
const config = {
  content: [
    // ...
    "./node_modules/@marthvon/mazehub/dist/**/*.{js,ts,jsx,tsx,mdx,css}"
  ] // ...
```
Or, ensure compiled tailwind codegen css file includes classes:
``` 
w-full h-full z-10 overflow-visible
``` 

## How To Use?

### Example
```jsx
<Suspense fallback={<>Loading Mazemap...</>}> {/* <- Wrap Mazehub components inside Suspense Component */}
   <MazeMapApi> {/* provides MazemapApi to childe elements through useMapApi() context */}
      <MarkerProvider markers={markers}> {/* Optional */}
         <GpsNavigation zLevel={1} accuracy={25}> {/* Optional  */}
            <MazeMapConsumer campuses={296} center={{ lng: 115.895, lat: -32.006 }} highlighter={{
               showOutline:true, showFill:true,
               outlineColor:"MazeBlue", fillColor:"MazeBlue"
            }} />
         </GpsNavigation>
      </MarkerProvider>
   </MazeMapApi>
</Suspense>
```

## Core Structure

```jsx
<Suspense fallback={<>Loading Mazemap...</>}> {/* <- Wrap Mazehub components inside Suspense Component */}
   <MazeMapApi> {/* provides MazemapApi to childe elements through useMapApi() context */}
      {/* Add other modules and construct map with only features you need */}
      <MazeMapConsumer campuses={296} center={{ lng: 115.895, lat: -32.006 }} highlighter={{
         showOutline:true, showFill:true,
         outlineColor:"MazeBlue", fillColor:"MazeBlue"
      }} />
      {/* Add other modules and construct map with only features you need */}
   </MazeMapApi>
</Suspense>
```

## Map Modules

1. <MarkerProvider ... /> Module
1. <ClusterMarkerProvider ... /> Module
1. <GpsNavigation ... /> Module

## How to Write You're own Map Module

```tsx
import { useEffect, useRef } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import { MapRefAPI, useMapAPI } from "./mazemap_api";

const MapModule({ children }: { children?: ReactNode }) {
  // static methods inside Mazemap Package
  const { colorPresets } = useMazemapPackage(); // example static method colorPresets
  
  // returns MapApi for MapInstance inside <MazeMapApi> ... <MazeMapConsumer /> ... </MazeMapApi>
  const { mapRef } = useMapAPI();  
```

## Mazemap Static Methods

```ts
fetchPoiData: (lngLat: LngLatType, zLevel: number) => Promise<PoiData>;
fetchPoiDataFromId: (poiId: number) => Promise<PoiData>;
fetchPoiDataFromBldg: (bldgId: number) => Promise<PoiData>;
fetchRouteJson: (start: LocationType, dest: LocationType) => Promise<RouteJsonObject>;
colorPresets: (color: MazemapColor | string | undefined) => string|"#.*";
setToken: (token: string) => void;
```

## Mazemap Instance Api Methods

```ts
/* Getters */
getMazeMap: () => typeof window.Mazemap.Map;
isLoaded: () => Set<string> | null;
/* Map API Methods */
addMarker: (
  zLevel: number, lngLat: LngLatType,
  props?: MarkerBaseType | MarkerGlyphType | MarkerImgType, 
) => typeof window.Mazemap.MazeMarker;
addZlevelMarker: (
  zLevel: number, lngLat: LngLatType, 
  el: HTMLElement, props?: ZLevelMarkerType
) => typeof window.Mazemap.ZLevelMarker;
displayRoute: (
  poi : { start: LocationType, dest: LocationType } | RouteJsonObject, 
  padding?: number, config?:RouterConfig
) => RouteJsonObject|Promise<RouteJsonObject>;
clearRoute: () => void;
displayBlueDot: (
  latLng: LngLatType, zLevel: number, accuracy: number, 
  props?: { bearing?: { value: number, accuracy: number }, color?: string}
) => BlueDot|Promise<BlueDot>;
highlightPoi: (poi: PoiData | LocationType, config?: Partial<HighlighterConfig>) => PoiData | Promise<PoiData>;
clearHighlight: () => void|Promise<void>;
```

## Types

```ts
type LngLatType = {
  lng: number; 
  lat: number;
}

type MazemapColor = "MazeBlue" | "MazePink" | "MazeOrange" | "MazeRed" | "MazeGreen" | "MazePurple";
type MarkerColor = MazemapColor;

type HighlighterConfig = { 
  showOutline:boolean, showFill:boolean,
  outlineColor?:MazemapColor, fillColor?:MazemapColor
}

type RouterConfig = {
  showDirectionArrows?:boolean, 
  routeLineColorPrimary?:string, 
  routeLineColorSecondary?:string
}

// check global.d.ts for the rest of the types
```

# Future Updates

1. Dungeon Controlling Modules (WASD & Virtual Joystick for Mobile)