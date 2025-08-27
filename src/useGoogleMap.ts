import {useEffect, useRef} from 'react';
import {Loader} from '@googlemaps/js-api-loader';

export const useGoogleMap = (
  mapId = 'DEMO_MAP_ID',
  defaultCenter = {lat: 37.5665, lng: 126.978}
) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const remoteMarkerRef = useRef<google.maps.Marker | null>(null);

  // 지도 초기화
  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
    });

    loader.load().then(async () => {
      const {Map} = (await google.maps.importLibrary(
        'maps'
      )) as google.maps.MapsLibrary;
      const {AdvancedMarkerElement} = (await google.maps.importLibrary(
        'marker'
      )) as google.maps.MarkerLibrary;

      const initMap = (center: google.maps.LatLngLiteral) => {
        if (!mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          zoom: 17,
          center,
          mapId,
          disableDefaultUI: true,
        });

        mapRef.current = map;

        const userMarker = new AdvancedMarkerElement({
          map,
          position: center,
          title: '내 위치',
        });

        userMarker.addListener('gmp-click', () => {
          map.setCenter(center);
        });
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            initMap({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            initMap(defaultCenter);
          }
        );
      } else {
        initMap(defaultCenter);
      }
    });
  }, [mapId, defaultCenter]);

  // 상대 위치 업데이트
  const updateRemoteMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return;

    if (!remoteMarkerRef.current) {
      remoteMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: {lat, lng},
        title: '상대 위치',
        icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      });
    } else {
      remoteMarkerRef.current.setPosition({lat, lng});
    }
  };

  return {mapContainerRef, updateRemoteMarker};
};
