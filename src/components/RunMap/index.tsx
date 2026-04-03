import MapboxLanguage from '@mapbox/mapbox-gl-language';
import maplibregl from 'maplibre-gl';
import React, { useRef, useCallback, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, {
  Layer,
  Source,
  FullscreenControl,
  NavigationControl,
  MapRef,
} from 'react-map-gl';
import { MapInstance } from 'react-map-gl/src/types/lib';
import { Link } from 'react-router-dom';
import useActivities from '@/hooks/useActivities';
import {
  MAP_LAYER_LIST,
  IS_CHINESE,
  ROAD_LABEL_DISPLAY,
  MAIN_COLOR,
  MAPBOX_TOKEN,
  MAP_TILE_ACCESS_TOKEN,
  MAP_TILE_STYLES,
  MAP_TILE_STYLE_DARK,
  MAP_TILE_VENDOR,
  PROVINCE_FILL_COLOR,
  USE_DASH_LINE,
  LINE_OPACITY,
  PRIVACY_MODE,
} from '@/utils/const';
import {
  Coordinate,
  IViewState,
  geoJsonForMap,
  formatPace,
  convertMovingTime2Sec,
  RUN_TYPE,
  HIKE_TYPE,
  RIDE_TYPE,
  VIRTUAL_RIDE_TYPE,
  EBIKE_RIDE_TYPE,
  WALK_TYPE,
  SWIM_TYPE,
  ROWING_TYPE,
  KAYAKING_TYPE,
  SNOWBOARD_TYPE,
  SKI_TYPE,
  ROAD_TRIP_TYPE,
  CROSSFIT_TYPE,
  WEIGHT_TRAINING_TYPE,
  WORKOUT_TYPE,
  YOGA_TYPE,
  Activity,
} from '@/utils/utils';
import RunMarker from './RunMarker';
import ActivityIcon from '@/components/ActivityIcon';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';

interface IRunMapProps {
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
  showActivityOverlay?: boolean;
}

const RunMap = ({
  viewState,
  setViewState,
  changeYear: _changeYear,
  geoData,
  thisYear: _thisYear,
  showActivityOverlay = true,
}: IRunMapProps) => {
  const { provinces } = useActivities();
  const mapRef = useRef<MapRef>();
  const lights = !PRIVACY_MODE;
  const vendorStyles =
    ((MAP_TILE_STYLES as unknown as Record<string, Record<string, string>>)[
      MAP_TILE_VENDOR
    ] as Record<string, string> | undefined) || MAP_TILE_STYLES.mapcn_openfreemap;
  const isMapboxStyle = String(MAP_TILE_VENDOR) === 'mapbox';
  const selectedStyle =
    vendorStyles[MAP_TILE_STYLE_DARK] || MAP_TILE_STYLES.mapcn_openfreemap['dark-matter'];
  const FALLBACK_STYLE = selectedStyle.includes('?key=')
    ? `${selectedStyle}${MAP_TILE_ACCESS_TOKEN}`
    : selectedStyle;
  const [mapStyleUrl, setMapStyleUrl] = useState<string>(
    MAPBOX_TOKEN ? 'mapbox://styles/mapbox/dark-v10' : FALLBACK_STYLE
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);
  const keepWhenLightsOff = ['runs2'];
  function switchLayerVisibility(map: MapInstance, lights: boolean) {
    const styleJson = map.getStyle();
    styleJson.layers.forEach((it: { id: string }) => {
      if (!keepWhenLightsOff.includes(it.id)) {
        if (lights) map.setLayoutProperty(it.id, 'visibility', 'visible');
        else map.setLayoutProperty(it.id, 'visibility', 'none');
      }
    });
  }
  const mapRefCallback = useCallback(
    (ref: MapRef) => {
      if (ref !== null) {
        const map = ref.getMap();
        if (map && IS_CHINESE && isMapboxStyle) {
          map.addControl(new MapboxLanguage({ defaultLanguage: 'zh-Hans' }));
        }
        map.on('style.load', () => {
          if (!ROAD_LABEL_DISPLAY) {
            MAP_LAYER_LIST.forEach((layerId) => {
              map.removeLayer(layerId);
            });
          }
          mapRef.current = ref;
          switchLayerVisibility(map, lights);
        });
        map.on('load', () => {
          setMapLoaded(true);
        });
        // Fallback to tokenless style if style/tile loading fails (e.g., 401 in dev)
        map.on('error', (e: any) => {
          const msg = String(e?.error?.message || e?.message || '');
          if (
            MAPBOX_TOKEN &&
            (msg.includes('Unauthorized') ||
              msg.includes('401') ||
              msg.includes('403') ||
              msg.includes('Forbidden') ||
              msg.includes('Not Found'))
          ) {
            setMapStyleUrl(FALLBACK_STYLE);
          }
        });
      }
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        switchLayerVisibility(map, lights);
      }
    },
    [isMapboxStyle, mapRef, lights]
  );
  React.useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (mapLoaded) return;
    if (!mapStyleUrl.startsWith('mapbox://')) return;
    const t = setTimeout(() => {
      if (!mapLoaded) {
        setMapStyleUrl(FALLBACK_STYLE);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [MAPBOX_TOKEN, mapLoaded, mapStyleUrl]);
  const filterProvinces = provinces.slice();
  // for geojson format
  filterProvinces.unshift('in', 'name');

  const initGeoDataLength = geoData.features.length;
  const isBigMap = (viewState.zoom ?? 0) <= 3;
  if (isBigMap && IS_CHINESE) {
    // Show boundary and line together, combine geoData(only when not combine yet)
    if (geoData.features.length === initGeoDataLength) {
      geoData = {
        type: 'FeatureCollection',
        features: geoData.features.concat(geoJsonForMap().features),
      };
    }
  }

  const isSingleActivity = geoData.features.length === 1;
  const hasTrack =
    isSingleActivity && geoData.features[0].geometry.coordinates.length > 0;
  let startLon = 0;
  let startLat = 0;
  let endLon = 0;
  let endLat = 0;
  let run: Activity | null = null;
  if (isSingleActivity) {
    run = geoData.features[0].properties as Activity;
  }
  if (hasTrack) {
    const points = geoData.features[0].geometry.coordinates as Coordinate[];
    [startLon, startLat] = points[0];
    [endLon, endLat] = points[points.length - 1];
  }
  let dash = USE_DASH_LINE && !isSingleActivity && !isBigMap ? [2, 2] : [2, 0];
  const onMove = React.useCallback(
    ({
      viewState,
    }: {
      viewState: IViewState;
    }) => {
      setViewState(viewState);
    },
    [setViewState]
  );
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
  };
  const fullscreenButton: React.CSSProperties = {
    position: 'absolute',
    marginTop: '29.2px',
    right: '0px',
    opacity: 0.3,
  };
  const pad2 = (n: number) => String(n).padStart(2, '0');
  let timeRange = '';
  let displayDuration = '';
  if (run) {
    const durationTotalSeconds = convertMovingTime2Sec(run.moving_time);
    const hours = Math.floor(durationTotalSeconds / 3600);
    const minutes = Math.floor((durationTotalSeconds % 3600) / 60);
    const seconds = Math.floor(durationTotalSeconds % 60);
    displayDuration = `${hours}:${pad2(minutes)}:${pad2(seconds)}`;

    const startTime = run.start_date_local.split(' ')[1];
    if (startTime) {
      const [h, m, s] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(h, m, s);
      const endDate = new Date(
        startDate.getTime() + durationTotalSeconds * 1000
      );
      const endTime = endDate.toTimeString().split(' ')[0];
      timeRange = `${startTime}~${endTime}`;
    }
  }

  return (
    <div className="relative w-full h-full">
      <Map
        {...viewState}
        onMove={onMove}
        style={style}
        mapLib={isMapboxStyle ? undefined : (maplibregl as any)}
        mapStyle={mapStyleUrl}
        ref={mapRefCallback}
        mapboxAccessToken={isMapboxStyle ? MAPBOX_TOKEN : undefined}
        attributionControl={false}
      >
        <Source id="data" type="geojson" data={geoData}>
          <Layer
            id="province"
            type="fill"
            paint={{
              'fill-color': PROVINCE_FILL_COLOR,
            }}
            filter={filterProvinces}
          />
          <Layer
            id="runs2"
            type="line"
            paint={{
              'line-color': MAIN_COLOR,
              'line-width': isBigMap && lights ? 1 : 2,
              'line-dasharray': dash,
              'line-opacity':
                isSingleActivity || isBigMap || !lights ? 1 : LINE_OPACITY,
              'line-blur': 1,
            }}
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
          />
        </Source>
        {hasTrack && (
          <RunMarker
            startLat={startLat}
            startLon={startLon}
            endLat={endLat}
            endLon={endLon}
          />
        )}
        <FullscreenControl style={fullscreenButton} />
        <NavigationControl
          showCompass={false}
          position={'bottom-right'}
          style={{ opacity: 0.3 }}
        />
      </Map>
      <div className="absolute bottom-28 right-2 z-10">
        <div
          className={`rounded-full border border-white/20 bg-white/90 text-black shadow-lg backdrop-blur-sm transition-all ${
            isAttributionOpen ? 'rounded-2xl px-3 py-1.5' : 'h-6 w-6'
          }`}
        >
          {isAttributionOpen ? (
            <div className="flex items-center gap-2 text-[11px] leading-4 whitespace-nowrap">
              <span>
                MapLibre | OpenFreeMap | OpenMapTiles Data from OpenStreetMap
              </span>
              <button
                type="button"
                onClick={() => setIsAttributionOpen(false)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-black/70 hover:bg-black/10 hover:text-black"
                aria-label="Collapse map attribution"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAttributionOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-black/80"
              aria-label="Expand map attribution"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {showActivityOverlay && isSingleActivity && run && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl px-4 py-3 w-72 relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-primary font-bold truncate">
                  <div className="shrink-0">
                    <ActivityIcon size={16} type={run.type} />
                  </div>
                  <span className="truncate">{run.name}</span>
                </div>
                <div className="text-xs text-gray-400 font-mono pl-6">
                  {timeRange}
                </div>
              </div>
              <Link
                to={`/run/${run.run_id}`}
                className="ml-2 text-gray-400 hover:text-white transition-colors pointer-events-auto shrink-0"
                title="View Details"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </Link>
            </div>
            <div className="flex justify-between items-end gap-2">
              <div>
                <div className="text-[10px] text-blue-400 font-bold tracking-[0.6px] uppercase">
                  KM
                </div>
                <div className="text-lg font-bold text-primary tabular-nums text-[yellow]">
                  {(run.distance / 1000).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-purple-400 font-bold tracking-[0.6px] uppercase">
                  Time
                </div>
                <div className="text-lg font-bold text-primary tabular-nums text-white">
                  {displayDuration}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-400 font-bold tracking-[0.6px] uppercase">
                  Pace
                </div>
                <div className="text-lg font-bold text-primary tabular-nums text-[#81d4fa]">
                  {formatPace(run.average_speed)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-red-400 font-bold tracking-[0.6px] uppercase">
                  BPM
                </div>
                <div className="text-lg font-bold text-primary tabular-nums text-[red]">
                  {run.average_heartrate?.toFixed(0) || '--'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunMap;
