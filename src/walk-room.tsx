import { useEffect } from "react";
import { useGoogleMap } from "./useGoogleMap";
import { useRealtimeWalker } from "./utils/useRealtimeWalker";
import { useMapStateStore } from "./store/mapStateStore";

type WalkRoomProps = {
  roomId: string;
  role: "walker" | "owner" | null;
};

export const WalkRoom = ({ roomId, role }: WalkRoomProps) => {
  // 지도 초기화
  const { mapContainerRef } = useGoogleMap();

  // WebRTC + 실시간 마커 연결
  const { sendMyLocation } = useRealtimeWalker(roomId, role);

  const center = useMapStateStore((state) => state.center);

  // 위치가 바뀔 때마다 내 위치 전송 (2초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      if (center && role === "walker") {
        // 워커일 때만 위치 전송
        sendMyLocation(center.lat, center.lng);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [center, role, sendMyLocation]);

  return (
    <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
  );
};
