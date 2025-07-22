"use client";
import type { ForwardedRef, MutableRefObject, ReactNode } from "react";
import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useMapAPI } from "./mazemap_api";
import { useMazemapPackage } from "./mazemap_package";
import { syncResult } from "./mazemap";

const GpsNavigation = forwardRef(({ 
  children, zLevel, bearing, hide, color, onError, onMove
}: { 
  children?: ReactNode, zLevel: number,
  bearing?: number, color?: string, hide?: boolean, 
  onMove?: (pos:LngLatType)=>void, 
  onError?: (err:GeolocationPositionError)=>void
}, posRef: ForwardedRef<LngLatType>) => {
  const { colorPresets } = useMazemapPackage();
  const { mapRef } = useMapAPI();
  const watchId : MutableRefObject<number|undefined> = useRef();
  const blueDot : MutableRefObject<Promise<BlueDot>|BlueDot|undefined> = useRef();
  const deferListeners : MutableRefObject<[keyof WindowEventMap, (e: DeviceOrientationEvent)=>any][]> = useRef([]);

  function onBearingChange(e: DeviceOrientationEvent) {
    e.alpha ?? syncResult(blueDot.current, self=>self?.setBearing(e.alpha as number));
  }
  function cleanupDeferredListeners() {
    for(const [event, callback] of deferListeners.current)
      window.removeEventListener(event, callback as any);
  }
  function logBearingNotTrackErr() {
    console.error("Cannot track user bearing accuracy");
    cleanupDeferredListeners();
    blueDot.current && syncResult(blueDot.current, self=>self.hideBearingHint());
  }
  const onBearingChangeAbsolute = useMemo(() => { 
    return (e: DeviceOrientationEvent) => {
      if(deferListeners.current.length == 2) {
        window.removeEventListener("deviceorientation", onBearingChange);
        deferListeners.current.pop();
      }
      onBearingChange(e);
    }
  }, []);
  useEffect(() => cleanupDeferredListeners, []);
  function bearingPermission() {
    if(deferListeners.current.length > 0)
      return;
    if (
      typeof DeviceOrientationEvent === "undefined" || 
      typeof (DeviceOrientationEvent as any).requestPermission !== "function"
    ) 
      logBearingNotTrackErr();
    else {
      (DeviceOrientationEvent as any).requestPermission().then((res:string) => {
        if (res !== "granted") {
          logBearingNotTrackErr();
          return;
        }
        if(deferListeners.current.length > 0)
          return;
        window.addEventListener("deviceorientationabsolute", onBearingChangeAbsolute);
        window.addEventListener("deviceorientation", onBearingChange);
        deferListeners.current = [
          ["deviceorientationabsolute", onBearingChangeAbsolute],
          ["deviceorientation", onBearingChange]
        ];
      })
    }
  } 
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>self.setZlevel(zLevel));
  }, [ zLevel ]);
  useEffect(() => {
    blueDot.current && (
      bearing? syncResult(blueDot.current, self=>{
        self.setBearingAccuracy(bearing);
        self.showBearingHint();
        bearingPermission();
      }): (
        cleanupDeferredListeners() as undefined || 
        syncResult(blueDot.current, self=>self.hideBearingHint())
      )
    );
  }, [ bearing ]);
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>self.setColor(colorPresets(color)));
  }, [ color ]);
  useEffect(() => {
    blueDot.current && syncResult(blueDot.current, self=>hide?
      self.hide() : (self.show() && mapRef.current?.getMazeMap().flyTo(self.lngLat)));
  }, [ hide ]);
  function init() {
    watchId.current = navigator.geolocation.watchPosition((position) => {
      const pos = {
        lng: position.coords.longitude,
        lat: position.coords.latitude
      };
      posRef && (posRef instanceof Function? posRef(pos) : (posRef.current = pos));
      onMove && onMove(pos);
      if(blueDot.current) {
        syncResult(blueDot.current, self=>{
          self.setLngLatAnimated(pos);
          self.setAccuracy(position.coords.accuracy)
        });
      } else {
        syncResult((blueDot.current = mapRef.current!.displayBlueDot(
          pos, zLevel, position.coords.accuracy, { bearing: { value: 0, accuracy: bearing??0 }, color }
        )), self=>(blueDot.current=self) && (hide? self.hide() : mapRef.current?.getMazeMap().flyTo(pos)));
      }
    }, (err) => { console.error(err); onError && onError(err) }, {
      enableHighAccuracy: true,
      maximumAge: 1000, timeout: 10000,
    });
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
GpsNavigation.displayName = "GpsNavigation";
export default GpsNavigation;