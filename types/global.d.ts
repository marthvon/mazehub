/// <reference types="react" />
type LngLatType = {
  lng: number; 
  lat: number;
}
type LocationType = { lngLat: LngLatType, zLevel: number };
type MazeMapProps = {
  campuses: number, center: LngLatType, zoom?: number, zLevel?: number, 
  highlighter?: HighlighterConfig, router?: RouterConfig
  onLoad?: (self: typeof window.Mazemap)=>void, 
  onClick?: (e: MazemapClickEvent)=>void, // @ts-ignore
  timeoutManager?: TimeoutManager,
  children?: React.ReactNode
};
type RouteJsonObject = any; // later
type HighlighterConfig = { 
  showOutline:boolean, showFill:boolean,
  outlineColor?:MazemapColor, fillColor?:MazemapColor
}
type RouterConfig = {
  showDirectionArrows?:boolean, 
  routeLineColorPrimary?:string, 
  routeLineColorSecondary?:string
}
type MazemapBaseClickEvent = {
  latLng: LngLatType, originalEvent: MouseEvent
};
type MazemapClickEvent = MazemapBaseClickEvent & {
  target: typeof window.Mazemap, point: { x:number, y:number }
};
type PoiData = {
  type: "Feature",
  geometry: {
    type: "Polygon" | string,
    coordinates: [number, number][][]
  },
  properties: {
    title:string, id:number, poiId:number, identifier:string,
    campusId:number, buildingName:string, buildingId:number,
    floorId:number, zLevel:number, floorName:string, 
    kind: "room" | string, names: string[],
    point: {
      type: "Point",
      coordinates: [ number, number ]
    }
    types: {
      poiTypeId: number, iconId:number|null,
      name: "Corridor"|"Cafe"|"Elevator"|string
    }[],
    infoUrl: null|string, infoUrlText: null|string, 
    descriptions: null|string, images: string[],
    peopleCapacity: number|null, externalReferenceTypes: string[]
  }
};

type MazemapColor = "MazeBlue" | "MazePink" | "MazeOrange" | "MazeRed" | "MazeGreen" | "MazePurple";
type MarkerColor = MazemapColor;

type MarkerBaseType = { 
  color?: MarkerColor, shape?: "marker" | "circle", size?: number,
  innerCircle?: { color: string, scale: number }, // ex. color: '#FEFEFE', scale: 0.5,
  onClick?:(e: MarkerClickEvent)=>void
};
type MarkerGlyphType = MarkerBaseType & {
  glyph: { icon: string, color: string, size: number } // ex. icon: '🖨', color:'#FFF', size: 25
};
type MarkerImgType = MarkerBaseType & {
  img: { url: string, scale: number } // ex. url: 'https://your.website.com/svg-images/wc-icon.svg', scale: 0.8
};
type ZLevelMarkerType = {
  offset?: [number, number]|null, offZOpacity?: number,
  onClick?: (e: ZMarkerClickEvent) => void
};

type MarkerClickEvent = MazemapBaseClickEvent & { target: typeof window.Mazemap.MazeMarker };
type ZMarkerClickEvent = MazemapBaseClickEvent & { target: typeof window.Mazemap.ZLevelMarker };

declare class BlueDot extends window.Mazemap.BlueDot {
  setLngLat(latLng: LngLatType): this;
  setLngLatAnimated(latLng: LngLatType): this;
  setZlevel(zLevel: number): this;
  setAccuracy(accuracy: number): this;
  setBearing(bearing: number): this;
  setBearingAccuracy(accuracy: number): this;
  setColor(color: string): this
  showBearingHint(): this;
  hideBearingHint(): this;
  show(): this;
  hide(): this;
  destroy(): this;
}
type MarkerInst = typeof window.Mazemap.MazeMarker | typeof window.Mazemap.ZLevelMarker;
type BBoxRect = [ number, number, number, number ];

interface MarkerType { zLevel: number, latLng: LngLatType, timestamp: Date }

type MarkerFactory = {
  type: "base", maxBatchSize?: number, 
  props?: (MarkerBaseType | MarkerGlyphType | MarkerImgType) | (
    (data:MarkerType, key: string)=> (MarkerBaseType | MarkerGlyphType | MarkerImgType | undefined)
)} | {
  props?: ZLevelMarkerType | ((data:MarkerType, key: string)=> (ZLevelMarkerType | undefined)),
  el: HTMLElement | ((data:MarkerType, key: string)=>HTMLElement), type: "zlevel", maxBatchSize?: number,
};