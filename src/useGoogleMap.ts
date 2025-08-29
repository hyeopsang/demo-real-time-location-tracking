import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useMapStateStore } from "./store/mapStateStore";
import { useWalkerStateStore } from "./store/walkerStateStore";

export const useGoogleMap = (
  mapId = "DEMO_MAP_ID",
  defaultCenter = { lat: 37.5665, lng: 126.978 }
) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = useMapStateStore((state) => state.center);
  const zoom = useMapStateStore((state) => state.zoom);
  const setCenter = useMapStateStore((state) => state.setCenter);
  const walkerCenter = useWalkerStateStore((state) => state.center);

  // 내 위치 마커
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );
  // 상대 위치 마커
  const remoteMarkerRef = useRef<google.maps.Marker | null>(null);

  // 지도 초기화
  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: "weekly",
    });

    loader.load().then(async () => {
      const { Map } = (await google.maps.importLibrary(
        "maps"
      )) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;

      if (!mapContainerRef.current) return;

      const map = new Map(mapContainerRef.current, {
        zoom,
        center,
        mapId,
        disableDefaultUI: true,
      });

      mapRef.current = map;

      // 내 위치 마커 생성
      userMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: center,
        title: "내 위치",
      });

      userMarkerRef.current.addListener("gmp-click", () => {
        map.setCenter(center);
      });

      // 내 위치 가져오기
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newCenter = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCenter(newCenter);
            if (userMarkerRef.current) {
              userMarkerRef.current.position = newCenter;
            }
            map.setCenter(newCenter);
          },
          () => {
            setCenter(defaultCenter);
            if (userMarkerRef.current) {
              userMarkerRef.current.position = defaultCenter;
            }
            map.setCenter(defaultCenter);
          }
        );
      } else {
        setCenter(defaultCenter);
        if (userMarkerRef.current) {
          userMarkerRef.current.position = defaultCenter;
        }
        map.setCenter(defaultCenter);
      }
    });
  }, [mapId, defaultCenter, setCenter, center, zoom]);

  const updateRemoteMarker = () => {
    if (!mapRef.current) return;

    if (!remoteMarkerRef.current) {
      remoteMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: walkerCenter,
        title: "상대 위치",
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });
    } else {
      remoteMarkerRef.current.setPosition(walkerCenter);
    }
  };

  // walkerCenter 변경 시 자동 갱신
  useEffect(() => {
    updateRemoteMarker();
  }, [walkerCenter]);

  return { mapContainerRef, updateRemoteMarker };
};
