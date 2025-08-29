import { useEffect } from "react";
import { useWalkerStateStore } from "../store/walkerStateStore";
import { useWebRTC } from "./useWebRTC";
import { useGoogleMap } from "../useGoogleMap";

export const useRealtimeWalker = (roomId: string, role: "walker" | "owner") => {
  const { sendLocation, remoteLocation } = useWebRTC(roomId, role);
  const setWalkerCenter = useWalkerStateStore((state) => state.setCenter);
  const walkerCenter = useWalkerStateStore((state) => state.center);

  const { updateRemoteMarker } = useGoogleMap(); // 지도 훅에서 마커 갱신 함수 가져오기

  // WebRTC로 받은 상대 위치가 바뀌면 Zustand 업데이트
  useEffect(() => {
    if (remoteLocation) {
      setWalkerCenter(remoteLocation);
    }
  }, [remoteLocation, setWalkerCenter]);

  // walkerCenter가 바뀌면 마커 갱신
  useEffect(() => {
    updateRemoteMarker();
  }, [walkerCenter, updateRemoteMarker]);

  // 위치 전송
  const sendMyLocation = (lat: number, lng: number) => {
    sendLocation(lat, lng);
  };

  return { sendMyLocation };
};
