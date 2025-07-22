"use client";
// ideally batch creation is handled by worker thread, 
// built on top of the Promise coroutined/async system
import { useEffect, useRef } from "react";
import type { MutableRefObject, ReactNode, RefObject } from "react";
import { MapRefAPI, useMapAPI } from "./mazemap_api";

type BatchType = {
  inserted: string[];
  deleted: string[];
  updated: string[]
};

// Edge cases (take in mind when testing):
// - 1st uEff X -> init() -> addAllMarker -> processBatch [loop or term]
// - 2nd uEff X -> Timer to addAllMarker -> processBatch [loop or term]
// other cases when updating markers:
// - While addAllMarker/processBatch X -> on end loop processBatch
// - While, no addAllMarker/processBatch X -> 1st uEff X processBatch

/**
 * MarkerProvider Component 
 * @param markers - try to always pass fresh reference when you want to trigger rerender. 
 * Passing same Object (same reference), regardless of change in internal key-values, will not trigger rerender for markers
 */
export default function MarkerProviderFactory(factory: MarkerFactory, comparison?: (a:MarkerType,b:MarkerType)=>boolean) {
  factory.maxBatchSize || (factory.maxBatchSize=4);
  const addMarker = factory.type === "base" ? async (mapRef: RefObject<MapRefAPI>, marker: MarkerType, key: string) =>
    mapRef.current?.addMarker(
      marker.zLevel, marker.latLng, 
      factory.props instanceof Function? factory.props(marker, key) : factory.props
    )
  : (factory.type === "zlevel"? async (mapRef: RefObject<MapRefAPI>, marker: MarkerType, key: string) =>
    mapRef.current?.addZlevelMarker(
      marker.zLevel, marker.latLng, 
      factory.el instanceof Function? factory.el(marker, key) : factory.el,
      factory.props instanceof Function? factory.props(marker, key) : factory.props
    )
  : (()=>{ throw new Error("Marker Provider cannot be resolve to either Base or Zlevel Marker") })());

  return function MarkerProvider({ markers, children, flushUpdate=false } : { markers: Record<string, MarkerType>, children?: ReactNode, flushUpdate?: boolean }) {
    const { mapRef } = useMapAPI();
    const prevMarkersData: MutableRefObject<Record<string, MarkerType>[]> = useRef([]);
    const prevMarkerInst: MutableRefObject<Record<string, MarkerInst>[]> = useRef([]);
    const batchQueue: MutableRefObject<Promise<BatchType>[]> = useRef([]);

    function dequeue() {
      prevMarkersData.current.shift();
      prevMarkerInst.current.shift();
      batchQueue.current.shift();
    }
    async function processBatch() {
      const { inserted, deleted, updated } = await batchQueue.current[0];
      if(inserted.length || deleted.length || updated.length) {
        const markerLock : [ string, Promise<any/*ZLevelMarker or MazeMarker*/> ][] = [];
        for(const inserts of inserted)
          markerLock.push([ inserts, addMarker(mapRef, markers[inserts], inserts) ]);
        const temp = { ...prevMarkerInst.current[0] };
        for(const updates of updated) {
          temp[updates].remove();
          markerLock.push([ updates, addMarker(mapRef, markers[updates], updates) ]);
        }
        for(const deletes of deleted) {
          temp[deletes].remove();
          delete temp[deletes];
        }
        for(const [ key, marker ] of markerLock)
          temp[key] = await marker;
        prevMarkerInst.current[1] = temp;
      } else
        prevMarkerInst.current[1] = prevMarkerInst.current[0];
      dequeue();
      if(batchQueue.current.length)
        processBatch();
    }
    async function addAllMarkers(index: number, pMarkers: Record<string, MarkerType>, checkBatch:boolean=true) {
      const promiseMarker : [ string, Promise<any/*ZLevelMarker or MazeMarker*/> ][] = []; 
      for(const [ key, marker ] of Object.entries(pMarkers))
        promiseMarker.push([key, addMarker(mapRef, marker, key)]);
      const temp : Record<string, MarkerInst> = {};
      for(const [ key, marker ] of promiseMarker)
        temp[key] = await marker;
      prevMarkerInst.current[index] = temp;
      prevMarkerInst.current.length = index+1;
      if(checkBatch && batchQueue.current.length)
        processBatch();
    }
    function init() {
      prevMarkerInst.current.length = 1;
      addAllMarkers(0, prevMarkersData.current[0]);
    }
    useEffect(() => {
      if(!flushUpdate && (mapRef.current && prevMarkerInst.current.length)) {
        let prev = (prevMarkersData.current.length > factory.maxBatchSize!? factory.maxBatchSize : prevMarkersData.current.length) as number;
        prevMarkersData.current[prev] = markers;
        batchQueue.current[prev-1] = createBatchMutations(markers, prevMarkersData.current[prev-1], comparison);
        // prevMarkerInst.current[0] is no longer undefined, addAllMarker missed timing, need to initiate batch processing again
        if(prev === 1 && prevMarkerInst.current[0])
          processBatch();
      } else {
        if(flushUpdate) for(const prevInsts of prevMarkerInst.current)
          for(const markerInst of prevInsts? Object.values(prevInsts):[])
            markerInst.remove();
        prevMarkersData.current[0] = markers;
        prevMarkersData.current.length = 1;
        mapRef.current && init();
      }
    }, [ markers ]);
    useEffect(() => {
      if(mapRef.current) {
        if(prevMarkerInst.current.length)
          return;
        init()  
        return;
      }
      let t : NodeJS.Timeout|undefined = (function retry() { return setTimeout(() => {
        if(prevMarkerInst.current.length == 0) {
          if(mapRef.current) init();
          else { t = retry(); return }
        } t = undefined;
      }, 500) })();
      return () => t && clearTimeout(t);
    }, []);
    useEffect(() => () => {
      batchQueue.current.length = 0;
      prevMarkersData.current.length = 0;
      prevMarkerInst.current.length = 1;
      for(const marker of Object.values(prevMarkerInst.current))
        marker.remove();
      prevMarkerInst.current.length = 0;
    }, []);
    return (<>{ children }</>);
  }
}

async function diffObject(newList: Record<string, MarkerType>, oldList: Record<string, MarkerType>) {
  const nKeys = new Set(Object.keys(newList)); 
  const oKeys = new Set(Object.keys(oldList));

  const retained = nKeys.intersection(oKeys);
  const inserted = Array.from(nKeys.difference(retained));
  const deleted = Array.from(oKeys.difference(retained));

  return { inserted, deleted, retained: Array.from(retained) }
};
async function timestampComparison(
  newList: Record<string, MarkerType>, oldList: Record<string, MarkerType>, keys: string[],
  comparison?:(a:MarkerType,b:MarkerType)=>boolean 
) {
  const updated = [];
  if(comparison) { for(const key of keys) 
    if(comparison(newList[key], oldList[key]))
      updated.push(key);
  } else for(const key of keys) if(
    newList[key] != oldList[key] && 
    newList[key].timestamp !== oldList[key].timestamp
  ) updated.push(key); 
  return updated;
}
function createBatchMutations(
  newList: Record<string, MarkerType>, oldList: Record<string, MarkerType>, 
  comparison?:(a:MarkerType,b:MarkerType)=>boolean
) : Promise<BatchType> {
  return new Promise((resolve) => diffObject(newList, oldList).then(
    ({ inserted, deleted, retained }) => 
      timestampComparison(newList, oldList, retained, comparison).then(
        (updated) => resolve({ inserted, deleted, updated })
      )
  ));
}