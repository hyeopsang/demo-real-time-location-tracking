import { useEffect, useCallback } from "react";
import { useWalkerStateStore } from "../store/walkerStateStore";
import { useMapStateStore } from "../store/mapStateStore";
import { useWebRTC } from "./useWebRTC";

export const useRealtimeWalker = (
  roomId: string,
  role: "walker" | "owner" | null
) => {
  const { sendLocation, remoteLocation, isConnected, connectionState } =
    useWebRTC(roomId, role);

  // Store hooks
  const setWalkerCenter = useWalkerStateStore((state) => state.setCenter);
  const walkerCenter = useWalkerStateStore((state) => state.center);
  const center = useMapStateStore((state) => state.center);
  const setCenter = useMapStateStore((state) => state.setCenter);

  // WebRTC로 받은 상대 위치가 바뀌면 상태 업데이트
  useEffect(() => {
    if (remoteLocation) {
      console.log(`${role} received remote location:`, remoteLocation);
      setWalkerCenter(remoteLocation);
    }
  }, [remoteLocation, setWalkerCenter, role]);

  // 내 현재 위치 전송
  const sendMyLocation = useCallback(
    (lat: number, lng: number) => {
      if (!isConnected) {
        console.warn(`${role} - WebRTC not connected, cannot send location`);
        return false;
      }

      console.log(`${role} sending location:`, { lat, lng });
      return sendLocation(lat, lng);
    },
    [sendLocation, isConnected, role]
  );

  // 현재 위치 기반으로 내 위치 전송
  const sendCurrentLocation = useCallback(() => {
    if (!center) {
      console.warn(`${role} - No current location available`);
      return false;
    }
    return sendMyLocation(center.lat, center.lng);
  }, [center, sendMyLocation, role]);

  // 실시간 위치 업데이트 (Geolocation API 사용)
  const updateLocationFromGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        console.log(`${role} got new geolocation:`, newLocation);

        // 내 위치 상태 업데이트
        setCenter(newLocation);

        // WebRTC로 위치 전송
        sendMyLocation(newLocation.lat, newLocation.lng);
      },
      (error) => {
        console.error(`${role} geolocation error:`, error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [setCenter, sendMyLocation, role]);

  // 연결 상태가 변경될 때마다 현재 위치 전송
  useEffect(() => {
    if (isConnected && center) {
      console.log(`${role} - Connection established, sending current location`);
      sendCurrentLocation();
    }
  }, [isConnected, center, sendCurrentLocation, role]);

  // 거리 계산 함수
  const calculateDistance = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371e3; // 지구 반지름 (미터)
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lng2 - lng1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // 미터 단위
    },
    []
  );

  // 내 위치와 상대 위치 간의 거리
  const getDistanceToRemote = useCallback((): number | null => {
    if (!center || !walkerCenter) return null;

    return calculateDistance(
      center.lat,
      center.lng,
      walkerCenter.lat,
      walkerCenter.lng
    );
  }, [center, walkerCenter, calculateDistance]);

  // 상대방이 특정 반경 내에 있는지 확인
  const isRemoteNearby = useCallback(
    (radiusInMeters: number = 100): boolean => {
      const distance = getDistanceToRemote();
      return distance !== null && distance <= radiusInMeters;
    },
    [getDistanceToRemote]
  );

  return {
    // 위치 전송 함수들
    sendMyLocation,
    sendCurrentLocation,
    updateLocationFromGeolocation,

    // 상태
    myLocation: center,
    remoteLocation: walkerCenter,
    isConnected,
    connectionState,

    // 거리 관련
    getDistanceToRemote,
    isRemoteNearby,
    calculateDistance,

    // 유틸리티
    role,
  };
};
