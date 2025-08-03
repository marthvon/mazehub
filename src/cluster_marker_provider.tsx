"use client";
import type { MutableRefObject, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Supercluster from "supercluster";
import type { PointFeature } from "supercluster";
import type MarkerProviderFactory from "./marker_provider";
import { useMapAPI } from "./mazemap_api";

async function toGeoJsonList(markerList: MarkerType[]) : Promise<PointFeature<{}>[]> {
  return markerList.map(marker => ({
    type: "Feature", geometry: {
      type: "Point",
      coordinates: [ marker.latLng.lng, marker.latLng.lat ]
    }, properties: {}
  }));
}

async function segregateZlevels(markerList: MarkerType[]) {
  const zlevelMarkers: { [key in number]: MarkerType[] } = {};
  for(const marker of markerList)
    (zlevelMarkers[marker.zLevel] ?? (zlevelMarkers[marker.zLevel]=[])).push(marker);
  return zlevelMarkers;
}

async function segregateZlevelsIn(zLevels: Set<number>, markerList: MarkerType[]) {
  const zlevelMarkers: { [key in number]: MarkerType[] } = {};
  for(const marker of markerList) if(zLevels.has(marker.zLevel))
    (zlevelMarkers[marker.zLevel] ?? (zlevelMarkers[marker.zLevel]=[])).push(marker);
  return zlevelMarkers;
}

function scanZoomIntervals(value: number, intervals: (number | ('<'|'<=') | 'x')[]): number|undefined {
  const evalRatioComp = {
    '<': (a:number, b:number) => a < b,
    '<=': (a:number, b:number) => a <= b
  } as const;
  let left = 0; let right = intervals.length-1;
  while(left <= right) {
    const mid = (left+right)/2;
    switch( // @ts-ignore
      evalRatioComp[intervals[mid+1]](value, intervals[mid+2]) // @ts-ignore val < x
      + (evalRatioComp[intervals[mid-1]](intervals[mid-2], value) << 1) // x < val
    ) {
      case 1: right = mid-2; break; // val < x
      case 2: left = mid+2; break; // x < val
      case 3: return intervals[mid] === 'x'? value : intervals[mid] as number;
    }
  }
  return (left == 0? intervals[2] : (right == 0 ? intervals.at(-2) : undefined)) as number|undefined;
}

export default function ClusterMarkerProviderFactory(MarkerProvider: ReturnType<typeof MarkerProviderFactory>) {
  return function ClusterMarkerProvider({ markers, children, zoomIntervals, bbox }: { 
    markers: Record<string, MarkerType>, children?: ReactNode, 
    zoomIntervals: (number | ('<'|'<=') | 'x')[], bbox: [number, number, number, number] 
  }) {
    const { mapRef } = useMapAPI();
    const prevMarker: MutableRefObject<Record<string, MarkerType> | undefined> = useRef();
    const prevZoom: MutableRefObject<number|undefined> = useRef(); 
    
    const clusters: MutableRefObject<Record<number, Supercluster>> = useRef({});
    const zLevelCoordinatesIndex: MutableRefObject<Record<string, [string, MarkerType]> | undefined> = useRef();
    const preclusters: MutableRefObject<Record<number, Promise<PointFeature<{}>[]>>> = useRef({});
    const isPreclusterProcessing = useRef(false);

    const clusterMarkerCache: MutableRefObject<Record<number, Record<string, MarkerType>>> = useRef({});
    const preclusterMarkerQueue: MutableRefObject<Record<number, Promise<Record<string, MarkerType>>>> = useRef({});
    const isPreclusterMarkerQueueProcessing = useRef(false);
    
    const [[displayMarkers, flushUpdate], setMarkers ] = useState<[Record<string, MarkerType>, boolean]>([{}, false]);

    async function generateClusterPoints(idx: number, zoom: number) : Promise<Record<string, MarkerType>> {
      const nextPointCache: Record<string, MarkerType> = {};
      const prevPointCache: Record<string, MarkerType> = clusterMarkerCache.current[idx] ?? {};
      for(const point of clusters.current[idx].getClusters(bbox, zoom)) {
        const key = point.properties.point_count + "\x1E" + point.geometry.coordinates;
        if(point.properties.cluster_id == undefined) {
          if(zLevelCoordinatesIndex.current == undefined) {
            zLevelCoordinatesIndex.current = {};
            for(const [key, value] of Object.entries(prevMarker.current ?? {}))
              zLevelCoordinatesIndex.current[
                value.zLevel+"\x1E"+value.latLng.lat+"\x1E"+value.latLng.lng
              ] = [key, value];
          }
          const [key, marker] = zLevelCoordinatesIndex.current[
            idx+"\x1E"+point.geometry.coordinates[1]+"\x1E"+point.geometry.coordinates[0]
          ];
          nextPointCache[key] = marker;
        } else if(prevPointCache[key]) {
          nextPointCache[key] = prevPointCache[key];
        } else {
          nextPointCache[key] = { 
            timestamp: new Date(), zLevel: idx, 
            point_count: point.properties.point_count,
            latLng: { 
              lat: point.geometry.coordinates[1], 
              lng: point.geometry.coordinates[0]
            }, 
            cluster_id: point.properties.cluster_id
          };
        }
      }
      return nextPointCache;
    }
    function allClusterMarkers() {
      return Object.assign({}, ...(Object.values(clusterMarkerCache.current)));
    }
    async function _populateClusterMarkers() {
      const preclusterMarkerKeys = Object.keys(preclusterMarkerQueue.current);
      if(preclusterMarkerKeys.length == 0)
        return;
      const zLevelCurr: number | undefined = mapRef.current && mapRef.current.getMazeMap().getZLevel();
      const zLevel = (zLevelCurr && preclusterMarkerQueue.current.hasOwnProperty(zLevelCurr))? 
        zLevelCurr : parseInt(preclusterMarkerKeys[0]);
      const zLevelPreclusterMarker = preclusterMarkerQueue.current[zLevel];
      delete preclusterMarkerQueue.current[zLevel];
      zLevelPreclusterMarker.then(newClusters => {
        clusterMarkerCache.current[zLevel] = newClusters;
        if(
          mapRef.current && 
          (mapRef.current.getMazeMap().getZLevel() === zLevel) && 
          mapRef.current.getMazeMap().getZoom() <= (zoomIntervals.at(-1) ?? 20)
        ) {
          setMarkers([allClusterMarkers(), false]);
        }
        if(Object.keys(preclusterMarkerQueue.current).length)
          populateClusterMarkers();
        else {
          isPreclusterMarkerQueueProcessing.current = false;
          setMarkers([allClusterMarkers(), false]);
        }
      });
    }
    function populateClusterMarkers() {
      isPreclusterMarkerQueueProcessing.current = true;
      _populateClusterMarkers();
    }
    async function _populateClusters() {
      const preclusterKeys = Object.keys(preclusters.current);
      if(preclusterKeys.length == 0)
        return;
      const zLevelCurr: number | undefined = mapRef.current && mapRef.current.getMazeMap().getZLevel();
      const zLevel = (zLevelCurr && preclusters.current.hasOwnProperty(String(zLevelCurr)))?
        zLevelCurr : parseInt(preclusterKeys[0]);
      const zLevelPrecluster = preclusters.current[zLevel];
      delete preclusters.current[zLevel];
      zLevelPrecluster.then(clusterRaw => {
        const temp = new Supercluster({ radius: 40, maxZoom: (zoomIntervals.at(-1) as number|undefined) ?? 20 });
        temp.load(clusterRaw);
        clusters.current[zLevel] = temp;
        if(mapRef.current && mapRef.current.getMazeMap().getZoom() <= (zoomIntervals.at(-1) ?? 20)) {
          preclusterMarkerQueue.current[zLevel] = generateClusterPoints(zLevel, mapRef.current.getMazeMap().getZoom());
          if(!isPreclusterMarkerQueueProcessing.current)
            populateClusterMarkers();
        }
        if(Object.keys(preclusters.current).length)
          populateClusters();
        else
          isPreclusterProcessing.current = false;
      });
    }
    function populateClusters() {
      isPreclusterProcessing.current = true;
      _populateClusters();
    }
    function populatePreclusters(zLevelsPreprocess: Promise<{[x: number]: MarkerType[]}>) {
      return zLevelsPreprocess.then(zLevelMarkers => {
        for(const [zLevel, markers] of Object.entries(zLevelMarkers))
          preclusters.current[zLevel as any] = toGeoJsonList(markers);
        if(!isPreclusterProcessing.current)
          populateClusters();
      });
    }
    useEffect(() => {
      if(prevMarker.current)
        createClusterReloads(markers, prevMarker.current)
          .then(zLevelList => 
            populatePreclusters(segregateZlevelsIn(zLevelList, Object.values(markers))));
      else
        populatePreclusters(segregateZlevels(Object.values(markers)));
      prevMarker.current = markers;
    }, [ markers ]);
    useEffect(() => {
      mapRef.current!.getMazeMap().on('zoomend', () => {
        const currZoom : number = mapRef.current!.getMazeMap().getZoom();
        if(currZoom > (zoomIntervals.at(-1) as number|undefined ?? 20)) {
          if(
            Object.keys(clusterMarkerCache.current).length ||
            Object.keys(preclusterMarkerQueue.current).length
          ) {
            clusterMarkerCache.current = {};
            preclusterMarkerQueue.current = {};
            prevMarker.current && setMarkers([prevMarker.current, true]);
          }
        } else {
          const newZoom = scanZoomIntervals(currZoom, zoomIntervals);
          if(prevZoom.current == newZoom)
            return;
          for(const zLevel of Object.keys(clusters.current).map(z => parseInt(z)))
            preclusterMarkerQueue.current[zLevel] = generateClusterPoints(
              zLevel, currZoom
            );
          if(!isPreclusterMarkerQueueProcessing.current)
            populateClusterMarkers();
        }
      });
    }, []);
    return (<MarkerProvider markers={displayMarkers} flushUpdate={flushUpdate}>{ children }</MarkerProvider>);
  }
}

async function diffObject(
  newList: Record<string, MarkerType>, 
  oldList: Record<string, MarkerType>, result: [Set<number>]
) : Promise<[string[], [Set<number>]]> {
  const nKeys = new Set(Object.keys(newList)); 
  const oKeys = new Set(Object.keys(oldList));

  const retained = nKeys.intersection(oKeys);
  for(const key of Array.from(nKeys.difference(retained)))
    result[0].add(newList[key].zLevel);
  for(const key of Array.from(oKeys.difference(retained)))
    result[0].add(oldList[key].zLevel);

  return [Array.from(retained), result];
};
async function positionComparison(newList: Record<string, MarkerType>, oldList: Record<string, MarkerType>, keys: string[], result: [Set<number>]) {
  for(const key of keys) if(
    newList[key].latLng.lat != oldList[key].latLng.lat || 
    newList[key].latLng.lng != oldList[key].latLng.lng
  ) result[0].add(newList[key].zLevel); 
  return result;
}
function createClusterReloads(
  newList: Record<string, MarkerType>, oldList: Record<string, MarkerType>
) : Promise<Set<number>> {
  return new Promise((resolve) => diffObject(newList, oldList, [new Set()]).then(
    ([ retained, result ]) => 
      positionComparison(newList, oldList, retained, result).then(
        (result) => resolve(result[0])
      )
  ));
}