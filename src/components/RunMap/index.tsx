import MapboxLanguage from '@mapbox/mapbox-gl-language';
import maplibregl from 'maplibre-gl';
import React, { useRef, useCallback, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, {
  AttributionControl,
  Layer,
  Source,
  FullscreenControl,
  NavigationControl,
  MapRef,
} from 'react-map-gl';
import { MapInstance } from 'react-map-gl/src/types/lib';
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
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';

interface IRunMapProps {
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
}

const RunMap = ({
  viewState,
  setViewState,
  changeYear: _changeYear,
  geoData,
  thisYear: _thisYear,
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
        <AttributionControl compact={true} position="bottom-right" />
      </Map>
    </div>
  );
};

export default RunMap;
