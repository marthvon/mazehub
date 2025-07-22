"use client";
// unfinished
import type { ForwardedRef, MutableRefObject, ReactNode } from "react";
import { forwardRef, useEffect, useRef } from "react";
import { useMapAPI } from "./mazemap_api";
import { useMazemapPackage } from "./mazemap_package";
import { syncResult } from "./mazemap";

const DungeonCrawling = forwardRef(({ 
  children, zLevel, accuracy, bearing, hide, color, onError, onMove
}: { 
  children?: ReactNode, zLevel: number, accuracy: number, 
  bearing?: { value: number, accuracy: number}, color?: string,
  hide?: boolean, onMove?: (pos:LngLatType)=>void,  
  onError?: (err:GeolocationPositionError)=>void
}, posRef: ForwardedRef<LngLatType>) => {
  const { colorPresets } = useMazemapPackage();
  const { mapRef } = useMapAPI();
  const watchId : MutableRefObject<number|undefined> = useRef();
  const blueDot : MutableRefObject<Promise<BlueDot>|BlueDot|undefined> = useRef();
  
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>self.setZlevel(zLevel));
  }, [ zLevel ]);
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>self.setAccuracy(accuracy));
  }, [ accuracy ]);
  useEffect(() => {
    blueDot.current && (
      bearing? syncResult(blueDot.current, self=>{
        self.setBearing(bearing.value);
        self.showBearingHint();
      }): syncResult(blueDot.current, self=>self.hideBearingHint())
    )
  }, [ bearing?.value ]);
  useEffect(() => {
    blueDot.current && (
      bearing? syncResult(blueDot.current, self=>{
        self.setBearingAccuracy(bearing.accuracy);
        self.showBearingHint();
      }): syncResult(blueDot.current, self=>self.hideBearingHint())
    )
  }, [ bearing?.accuracy ]);
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>self.setColor(colorPresets(color)));
  }, [ color ]);
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>hide?self.hide():self.show());
  }, [ hide ]);
  function init() {
    
  } 
  useEffect(() => {
    let t = mapRef.current? init() as undefined : (
      function retry() { return setTimeout(() => {
        if(mapRef.current) {
          init(); t = undefined;
        } else t = retry();
    }, 500) })();
    return () => { 
      t && clearTimeout(t);
      watchId.current && navigator.geolocation.clearWatch(watchId.current);
      blueDot.current && syncResult(blueDot.current, self=>self.destroy()); 
    };
  }, []);
  return (<>{ children }</>);
});
DungeonCrawling.displayName = "DungeonCrawling";
export default DungeonCrawling;