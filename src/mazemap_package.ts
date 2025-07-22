"use client";
declare global { interface Window { Mazemap?: any; } }

type MazemapPackageType =  {
  Mazemap: typeof window.Mazemap;
  fetchPoiData: (lngLat: LngLatType, zLevel: number) => Promise<PoiData>;
  fetchPoiDataFromId: (poiId: number) => Promise<PoiData>;
  fetchPoiDataFromBldg: (bldgId: number) => Promise<PoiData>;
  fetchRouteJson: (start: LocationType, dest: LocationType) => Promise<RouteJsonObject>;
  colorPresets: (color: MazemapColor | string | undefined) => string|"#.*";
  setToken: (token: string) => void;
};

let Mazemap: MazemapPackageType | Promise<MazemapPackageType> | null = null;
export function useMazemapPackage(): MazemapPackageType {
  if(Mazemap) {
    if(Mazemap instanceof Promise)
      throw Mazemap;
    return Mazemap;
  }
  throw (Mazemap = new Promise((resolve, reject) => {
    document.head.appendChild(Object.assign(
      document.createElement('script'), {
        src: 'https://api.mazemap.com/js/v2.2.1/mazemap.min.js',
        onload: () => resolve(Mazemap = {
          Mazemap: window.Mazemap, 
          fetchPoiDataFromId: (poiId: number) => window.Mazemap.Data.getPoi(poiId),
          fetchPoiData: (lngLat: LngLatType, zLevel: number) => window.Mazemap.Data.getPoiAt(lngLat, zLevel),
          fetchPoiDataFromBldg: (bldgId: number) => window.Mazemap.Data.getBuildingPoiJSON(bldgId),
          fetchRouteJson: (start: LocationType, dest: LocationType) => window.Mazemap.Data.getRouteJSON(start, dest),
          colorPresets: (color: MazemapColor|string|undefined) => color? (color.startsWith('#')? 
            color : window.Mazemap.Util.Colors.MazeColors[color]
          ) : window.Mazemap.Util.Colors.MazeColors.MazeBlue,
          setToken: (token:string) => window.Mazemap.Config.setMazemapViewToken(token) //process.env.MAZEMAP_TOKEN
        }),
        onerror: () => { Mazemap = null; reject(new Error('Failed to load Mazemap')) }
      })
    );
    document.head.appendChild(Object.assign(
      document.createElement('link'), {
        href: 'https://api.mazemap.com/js/v2.2.1/mazemap.min.css', rel: "stylesheet"
      })
    );
  }));
}