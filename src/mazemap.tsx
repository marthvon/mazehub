"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";
import type { ForwardedRef, MutableRefObject } from "react";
import { useMazemapPackage } from "./mazemap_package";
import type { MapRefAPI } from "./mazemap_api";

const isHighlightReady = "--highlight-up";
const isRouterReady = "--router-up";

const defaultRouter = {  
  showDirectionArrows:true, 
  routeLineColorPrimary:'#0099EA', 
  routeLineColorSecondary:'#888888'
};

type Map = any;
declare class RouteController {
  setPath(geojson: RouteJsonObject): this;
  clear(): this;
  remove(): this;
};

const MazeMap = forwardRef(({ 
  campuses, center, zoom=18, zLevel=1, children,
  highlighter, router, onLoad, onClick, timeoutManager
} : MazeMapProps, mapRef: ForwardedRef<MapRefAPI>)=> {
  const id = "--mazemap-"+useId();
  const map: MutableRefObject<Map> = useRef(null);
  const paths: MutableRefObject<RouteController|null> = useRef(null); 
  const isReady: MutableRefObject<Set<string>|null> = useRef(null);
  const prevHighlighter: MutableRefObject<HighlighterConfig|undefined> = useRef();
  const _internal: MutableRefObject<{
    tempHighlight?: HighlighterConfig, tempRoute?: boolean
  }> = useRef({});
  const { Mazemap, fetchRouteJson, fetchPoiData, colorPresets } = useMazemapPackage();
  useEffect(() => { map.current.flyTo({ center, zoom, speed: 0.5 }); }, [ center ]);
  useEffect(() => { map.current.zoomTo(zoom); }, [ zoom ]);
  function __patchHighlighter(newconfig: HighlighterConfig|undefined, prevconfig: HighlighterConfig|undefined) {
    if(newconfig) {
      if(newconfig.fillColor && newconfig.fillColor !== prevconfig?.fillColor)
        map.current.highlighter.setFillStyle({'fill-color': colorPresets(newconfig.fillColor)});
      if(newconfig.outlineColor && newconfig.outlineColor !== prevconfig?.outlineColor) 
        map.current.highlighter.setOutlineStyle({'line-color': colorPresets(newconfig.outlineColor)});
      if(newconfig.showFill && newconfig.showFill !== prevconfig?.showFill)
        newconfig.showFill? map.current.highlighter.showFill() : map.current.highlighter.hideFill();
      if(newconfig.showOutline && newconfig.showOutline !== prevconfig?.showOutline) 
        newconfig.showOutline? map.current.highlighter.showOutline() : map.current.highlighter.hideOutline();
      map.current.highlighter.showFill();
      map.current.highlighter.showOutline();
    } else {
      map.current.highlighter.clear();
      map.current.highlighter.hideFill();
      map.current.highlighter.hideOutline();
    }
  } function __updateHighlighter(config: HighlighterConfig|undefined) {
    __patchHighlighter(config, prevHighlighter.current);
  } function __restoreHighlighter(config: HighlighterConfig|undefined) {
    __patchHighlighter(config, { ...(prevHighlighter.current??{}), ...(_internal.current.tempHighlight as HighlighterConfig)});
    delete _internal.current.tempHighlight;
  }
  useEffect(() => { whenReady(() => {
    if(map.current.highlighter)
      _internal.current.tempHighlight? __restoreHighlighter(highlighter) : __updateHighlighter(highlighter);
    else if(highlighter) {
      map.current.highlighter = new Mazemap.Highlighter(map.current, { ...highlighter,
        outlineColor: highlighter.outlineColor && colorPresets(highlighter.outlineColor), 
        fillColor: highlighter.fillColor && colorPresets(highlighter.fillColor)
      });
      isReady.current!.add(isHighlightReady);
    }
    prevHighlighter.current = highlighter;
  }, isReady)() }, [ 
    highlighter?.showFill, highlighter?.showOutline, 
    highlighter?.fillColor, highlighter?.outlineColor 
  ]);

  function __defaultRouter() {
    paths.current && paths.current.remove()
    paths.current = router? new Mazemap.RouteController(map.current, { 
      ...defaultRouter, ...router
    }) : undefined;
    _internal.current.tempRoute = false;
  }
  useEffect(() => { (whenReady(() => {
    __defaultRouter();
    isReady.current!.add(isRouterReady);
  }, isReady))() }, [ 
    router?.routeLineColorPrimary, router?.routeLineColorSecondary, 
    router?.showDirectionArrows 
  ]);

  function __highlightPoi(poi: (PoiData | LocationType) & { [K in keyof PoiData]: PoiData[K] }) {
    if(poi["geometry"]?.type !== "Polygon")
      return;
    map.current.highlighter.highlight(poi);
    return poi;
  }
  useImperativeHandle(mapRef, () => { 
    map.current = new Mazemap.Map({
      container: id, campuses,
      center, zoom, zLevel,
      scrollZoom: !0, doubleClickZoom: !0,
      touchZoomRotate: !0, zLevelControl: !0
    });
    map.current.on('load', () => {
      onLoad && onLoad(map.current);
      onClick && map.current.on('click', onClick);
      let layers = [ 'mm-poi-label', 'mm-feature-highlight-fill', 'mm-feature-highlight-outline' ];
      isReady.current = new Set();
      (function scanLayers() { (timeoutManager? timeoutManager.setTimeout : setTimeout)(()=>{
        layers = layers.reduce((prev, curr) => {
          map.current.getLayer(curr)? 
            isReady.current!.add(curr)
            : prev.push(curr); 
          return prev;
        }, [] as string[]);
        layers.length && scanLayers();
      }, 1000) })();
    });
  return {
    /* Getters */
    getMazeMap: () => map.current,
    isLoaded: () => isReady.current,
    /* Map API Methods */
    addMarker: (
      zLevel: number, lngLat: LngLatType, 
      props:MarkerBaseType | MarkerGlyphType | MarkerImgType = {}, 
    ) => {
      const { 
        color="MazeBlue", shape='marker', size=30,
        innerCircle, glyph, img, onClick
      } : MarkerBaseType & Partial<MarkerGlyphType> & Partial<MarkerImgType> = props;
      const temp = new Mazemap.MazeMarker( {
        color, shape, size, zLevel,
        ...(innerCircle? {
          innerCircle: true, innerCircleColor: innerCircle.color, 
          innerCircleScale: innerCircle.scale
        } : {}),
        ...(glyph? { glyph: glyph.icon, glyphColor: glyph.color, glyphSize: glyph.size } 
          : (img? { imgUrl: img.url, imgScale: img.scale } : {}))
      }) 
        .setLngLat(lngLat)
        .addTo(map.current);
      onClick && temp.on('click', onClick);
      return temp; //.remove();
    },
    addZlevelMarker: (
      zLevel:number, lngLat: LngLatType, 
      el: HTMLElement, props: ZLevelMarkerType={}
    ) => {
      const { offset=[0,0], offZOpacity=0, onClick } = props;
      const temp = new Mazemap.ZLevelMarker(el, {
        zLevel, offset: offset ?? [0, -(() => {
          const rawHeight = el.style.height.match(/(.*?)(px|rem)/);
          if(rawHeight?.length)
            return rawHeight[2] == 'rem'? (Number(rawHeight[1]) * 16) : Number(rawHeight[1]);
          const h = el.className.match(/\bh-(\d+)\b/)
          return h?.length? (Number(h[1]) * 16) : 0;
        })()/2.0], offZOpacity
      })
        .setLngLat(lngLat)
        .addTo(map.current);
      onClick && temp.on('click', onClick);
      return temp;
    },
    displayRoute: whenReady((
      poi : { start: LocationType, dest: LocationType } | RouteJsonObject, 
      padding:number=100, config?:RouterConfig
    ) => {
      const { start, dest } : { start: LocationType, dest: LocationType } | { start?: undefined, dest?: undefined } = poi;
      const fetchRoute = start && dest? fetchRouteJson(start, dest) : undefined;
      if(config == undefined) {
        if(router == undefined) {
          paths.current = new Mazemap.RouteController(map.current, defaultRouter);
          _internal.current.tempRoute = true;
        } else if(_internal.current.tempRoute)
          __defaultRouter();
      } else {
        paths.current?.remove();
        paths.current = new Mazemap.RouteController(map.current, {
          ...defaultRouter, ...(router??{}), ...config
        });
        _internal.current.tempRoute = true;
      }
      const display = (geojson:RouteJsonObject) => {
        paths.current?.setPath(geojson);
        map.current.fitBounds( Mazemap.Util.Turf.bbox(geojson), { padding } );
        return geojson;
      }
      return fetchRoute? fetchRoute.then(display) : display(poi);
    }, isReady, [ 'mm-poi-label', isRouterReady ]),
    clearRoute: () => paths.current?.remove(),
    displayBlueDot: whenReady((
      latLng: LngLatType, zLevel: number, accuracy: number, props?: {
      bearing?: { value: number, accuracy: number }, color?: string
    }) => {
      const temp = new Mazemap.BlueDot({ map: map.current })
        .setLngLat(latLng)
        .setZLevel(zLevel)
        .setAccuracy(accuracy);
      if(props) {
        props.color && temp.setColor(colorPresets(props.color));
        props.bearing && temp
          .setBearing(props.bearing.value)
          .setBearingAccuracy(props.bearing.accuracy)
          .showBearingHint();
      }
      return temp.show();
    }, isReady),
    highlightPoi: whenReady((poi: (PoiData | LocationType) & { [K in keyof PoiData]: PoiData[K] }, config?: HighlighterConfig) => {
      if(config) {
        _internal.current.tempHighlight = config;
        __updateHighlighter(_internal.current.tempHighlight);
      } else if(_internal.current.tempHighlight)
        __restoreHighlighter(prevHighlighter.current)
      return __highlightPoi(poi) ?? 
        fetchPoiData((poi as LocationType).lngLat, (poi as LocationType).zLevel)
          .then(__highlightPoi);
    }, isReady, [ 'mm-feature-highlight-fill', 'mm-feature-highlight-outline', isHighlightReady ]),
    clearHighlight: whenReady(() => {
      map.current.highlighter?.clear();
    }, isReady, [ isHighlightReady ]),
  } as MapRefAPI }, []);
  return (<div id={id} className="w-full h-full z-10 overflow-visible">{ children }</div>);
});
MazeMap.displayName = "MazeMap";
export default MazeMap;

function whenReady<Args extends any[], Ret>(
  callback: (...args: Args)=>Ret, ref: MutableRefObject<Set<string>|null>, 
  layerIds: string[]=[], delay:number=1000, // @ts-ignore
  timeoutManager?: TimeoutManager
) : (...args: Args) => Ret|Promise<Ret> {
  let memo = layerIds.length === 0; 
  return function r(...args: Args) {
    if(ref.current && (memo || (memo = layerIds.reduce((prev, curr) => prev && ref.current!.has(curr), true))))
      return callback(...args);
    return new Promise((resolve) => { 
      (timeoutManager? timeoutManager.setTimeout : setTimeout)(() => resolve(r(...args)), delay) 
    });
  }
}

export function syncResult<T>(self: T|Promise<T>, callback: (self:T)=>any) {
  return self instanceof Promise? self.then(callback) : callback(self);
}