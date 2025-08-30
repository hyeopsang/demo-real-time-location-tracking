import { useEffect, useRef, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useMapStateStore } from "./store/mapStateStore";
import { useWalkerStateStore } from "./store/walkerStateStore";
import { useWebRTC } from "./utils/useWebRTC";

export const useGoogleMap = (
  roomId: string,
  role: "walker" | "owner" | null,
  mapId = "DEMO_MAP_ID",
  defaultCenter = { lat: 37.5665, lng: 126.978 }
) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const center = useMapStateStore((state) => state.center);
  const zoom = useMapStateStore((state) => state.zoom);
  const setCenter = useMapStateStore((state) => state.setCenter);
  const walkerCenter = useWalkerStateStore((state) => state.center);
  const setWalkerCenter = useWalkerStateStore((state) => state.setCenter);

  // 내 위치 마커
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );
  // 상대 위치 마커
  const remoteMarkerRef = useRef<google.maps.Marker | null>(null);

  // WebRTC 훅
  const { sendLocation, remoteLocation, isConnected } = useWebRTC(roomId, role);

  // 상대 위치 마커 업데이트 함수
  const updateRemoteMarker = useCallback(() => {
    if (!mapRef.current || !walkerCenter) return;

    if (!remoteMarkerRef.current) {
      remoteMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: walkerCenter,
        title: role === "walker" ? "주인 위치" : "산책자 위치",
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      // 상대 마커 클릭 시 해당 위치로 이동
      remoteMarkerRef.current.addListener("click", () => {
        if (mapRef.current && walkerCenter) {
          mapRef.current.setCenter(walkerCenter);
          mapRef.current.setZoom(16);
        }
      });
    } else {
      remoteMarkerRef.current.setPosition(walkerCenter);
    }
  }, [walkerCenter, role]);

  // 내 위치 업데이트 함수
  const updateMyLocation = useCallback(
    (position: { lat: number; lng: number }) => {
      setCenter(position);

      if (userMarkerRef.current) {
        userMarkerRef.current.position = position;
      }

      if (mapRef.current) {
        mapRef.current.setCenter(position);
      }

      // WebRTC로 위치 전송
      if (isConnected) {
        sendLocation(position.lat, position.lng);
      }
    },
    [setCenter, sendLocation, isConnected]
  );

  // 실시간 위치 추적 시작
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      updateMyLocation(defaultCenter);
      return;
    }

    // 현재 위치 한 번 가져오기
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        updateMyLocation(newCenter);
      },
      (error) => {
        console.error("Error getting current position:", error);
        updateMyLocation(defaultCenter);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // 실시간 위치 추적 시작
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        updateMyLocation(newCenter);
      },
      (error) => {
        console.error("Error watching position:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 30000, // 30초간 캐시된 위치 사용 허용
      }
    );
  }, [updateMyLocation, defaultCenter]);

  // 위치 추적 중지
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!role) return;

    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["maps", "marker"],
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
        disableDefaultUI: false,
      });

      mapRef.current = map;

      // 내 위치 마커 생성
      userMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: center,
        title: "내 위치",
      });

      // 내 마커 클릭 시 해당 위치로 이동
      userMarkerRef.current.addListener("gmp-click", () => {
        if (mapRef.current) {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(16);
        }
      });

      // 위치 추적 시작
      startLocationTracking();
    });

    return () => {
      stopLocationTracking();
    };
  }, [mapId, center, zoom, role, startLocationTracking, stopLocationTracking]);

  // WebRTC 연결 상태에 따라 위치 추적 관리
  useEffect(() => {
    if (isConnected && !watchIdRef.current) {
      startLocationTracking();
    }
  }, [isConnected, startLocationTracking]);

  // WebRTC로 받은 상대 위치가 바뀌면 상태 업데이트
  useEffect(() => {
    if (remoteLocation) {
      setWalkerCenter(remoteLocation);
    }
  }, [remoteLocation, setWalkerCenter]);

  // walkerCenter가 바뀌면 마커 갱신
  useEffect(() => {
    updateRemoteMarker();
  }, [walkerCenter, updateRemoteMarker]);

  // 수동으로 위치 전송
  const sendCurrentLocation = useCallback(() => {
    if (center && isConnected) {
      sendLocation(center.lat, center.lng);
    }
  }, [center, sendLocation, isConnected]);

  // 특정 위치로 지도 이동
  const moveToLocation = useCallback((lat: number, lng: number, zoom = 16) => {
    if (mapRef.current) {
      mapRef.current.setCenter({ lat, lng });
      mapRef.current.setZoom(zoom);
    }
  }, []);

  // 내 위치로 이동
  const moveToMyLocation = useCallback(() => {
    if (center) {
      moveToLocation(center.lat, center.lng);
    }
  }, [center, moveToLocation]);

  // 상대 위치로 이동
  const moveToRemoteLocation = useCallback(() => {
    if (walkerCenter) {
      moveToLocation(walkerCenter.lat, walkerCenter.lng);
    }
  }, [walkerCenter, moveToLocation]);

  return {
    mapContainerRef,
    sendLocation: sendCurrentLocation,
    updateRemoteMarker,
    moveToLocation,
    moveToMyLocation,
    moveToRemoteLocation,
    startLocationTracking,
    stopLocationTracking,
    isConnected,
    myLocation: center,
    remoteLocation: walkerCenter,
  };
};
