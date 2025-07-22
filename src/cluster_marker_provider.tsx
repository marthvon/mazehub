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

export default function ClusterMarkerProviderFactory(MarkerProvider: ReturnType<typeof MarkerProviderFactory>) {
  return function ClusterMarkerProvider({ markers, children, zoomIntervals }: { markers: Record<string, MarkerType>, children?: ReactNode, zoomIntervals: number[] }) {
    const { mapRef } = useMapAPI();
    const prevMarker: MutableRefObject<Record<string, MarkerType> | undefined> = useRef();
    const clusters: MutableRefObject<Record<number, Supercluster>> = useRef({});
    const preclusters: MutableRefObject<Record<number, Promise<PointFeature<{}>[]>>> = useRef({});
    const isPreclusterProcessing = useRef(false);
    const [[displayMarkers, flushUpdate], setMarkers ] = useState<[Record<string, MarkerType>, boolean]>([{}, false]);

    function generateClusterPoints(idx: number, bbox: GeoJSON.BBox, zoom: number) {
      return clusters.current[idx].getClusters(bbox, zoom); // Need cache and timestamp;
      // memoise through clusters.current[idx], bbox? zoom? 
    }
    function allClusterPoints(bbox: GeoJSON.BBox, zoom: number) {
      for(const idx of Object.keys(clusters.current))
        generateClusterPoints(idx as any, bbox, zoom);
    }
    async function _populateClusters() {
      const zLevelCurr: number | undefined = mapRef.current && mapRef.current.getMazeMap().getZLevel();
      const zLevel = zLevelCurr && preclusters.current.hasOwnProperty(zLevelCurr)? zLevelCurr : Object.keys(preclusters.current)[0];
      const zLevelPrecluster = preclusters.current[zLevel as any];
      delete preclusters.current[zLevel as any];
      zLevelPrecluster.then(clusterRaw => {
        const temp = new Supercluster({ radius: 40, maxZoom: 20 });
        temp.load(clusterRaw);
        clusters.current[zLevel as any] = temp;
        if((mapRef.current && mapRef.current.getMazeMap().getZLevel()) === zLevel) {
          // setMarkers update // partial clustera
        }
        if(Object.keys(preclusters.current).length)
          populateClusters();
        else {
          isPreclusterProcessing.current = false;
          // setMarkers update, merge all clusters
        }
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
      if(!isPreclusterProcessing.current)
        populateClusters();
    }, [ markers ]);
    useEffect(() => {
      mapRef.current!.getMazeMap().on('zoomend', () => {
        //const clusters = index.getClusters(bbox, zoom);
        console.log(mapRef.current!.getMazeMap().getZoom());
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