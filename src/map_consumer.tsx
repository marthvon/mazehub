"use client";

import MazeMap from "./mazemap";
import { useMapAPI } from "./mazemap_api";

export default function MazeMapConsumer(props: MazeMapProps) {
  const { mapRef } = useMapAPI();
  return (<><MazeMap {...props} ref={mapRef} /></>);
}