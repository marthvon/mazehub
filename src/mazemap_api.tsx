"use client";

import type { ReactNode, RefObject } from "react";
import { createContext, useContext, useRef } from "react";

type MazemapContextType = { mapRef: RefObject<MapRefAPI> };
const MazemapContext = createContext<MazemapContextType | undefined>(undefined);

export const useMapAPI = () => {
  const context = useContext(MazemapContext);
  if (!context)
    throw new Error('Missing MazeMapAPI');
  return context;
};

export default function MazeMapAPI({ children }: { children?: ReactNode }) {
  const mapRef = useRef<MapRefAPI>(null);
  return (<MazemapContext.Provider value={{ mapRef }}>{ children }</MazemapContext.Provider>);
}
export type MapRefAPI = {
  /* Getters */
  getMazeMap: () => typeof window.Mazemap.Map,
  isLoaded: () => Set<string> | null,
  /* Map API Methods */
  addMarker: (
    zLevel: number, lngLat: LngLatType,
    props?: MarkerBaseType | MarkerGlyphType | MarkerImgType, 
  ) => typeof window.Mazemap.MazeMarker,
  addZlevelMarker: (
    zLevel: number, lngLat: LngLatType, 
    el: HTMLElement, props?: ZLevelMarkerType
  ) => typeof window.Mazemap.ZLevelMarker,
  displayRoute: (
    poi : { start: LocationType, dest: LocationType } | RouteJsonObject, 
    padding?: number, config?:RouterConfig
  ) => RouteJsonObject|Promise<RouteJsonObject>,
  clearRoute: () => void,
  displayBlueDot: (
    latLng: LngLatType, zLevel: number, accuracy: number, 
    props?: { bearing?: { value: number, accuracy: number }, color?: string}
  ) => BlueDot|Promise<BlueDot>,
  highlightPoi: (poi: PoiData | LocationType, config?: Partial<HighlighterConfig>) => PoiData | Promise<PoiData>,
  clearHighlight: () => void|Promise<void>
};