import { useEffect, useCallback, useState } from "react";
import { useGoogleMap } from "./useGoogleMap";
import { useRealtimeWalker } from "./utils/useRealtimeWalker";
import { useMapStateStore } from "./store/mapStateStore";

type WalkRoomProps = {
  roomId: string;
  role: "walker" | "owner" | null;
};

export const WalkRoom = ({ roomId, role }: WalkRoomProps) => {
  const [lastSentLocation, setLastSentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // 지도 초기화 (필수 파라미터들 전달)
  const {
    mapContainerRef,
    moveToMyLocation,
    moveToRemoteLocation,
    remoteLocation,
    startLocationTracking,
    stopLocationTracking,
  } = useGoogleMap(
    roomId,
    role,
    "DEMO_MAP_ID",
    { lat: 37.5665, lng: 126.978 } // 서울 시청 기본 위치
  );

  // WebRTC + 실시간 위치 연결
  const {
    sendMyLocation,
    sendCurrentLocation,
    updateLocationFromGeolocation,
    isConnected: webrtcConnected,
    connectionState,
    getDistanceToRemote,
    isRemoteNearby,
  } = useRealtimeWalker(roomId, role);

  const center = useMapStateStore((state) => state.center);

  // 위치가 충분히 변경되었는지 확인하는 함수 (배터리 절약)
  const hasLocationChanged = useCallback(
    (
      newLat: number,
      newLng: number,
      threshold: number = 10 // 10미터 이상 변경시에만 전송
    ): boolean => {
      if (!lastSentLocation) return true;

      const distance = Math.sqrt(
        Math.pow((newLat - lastSentLocation.lat) * 111320, 2) +
          Math.pow(
            (newLng - lastSentLocation.lng) *
              111320 *
              Math.cos((newLat * Math.PI) / 180),
            2
          )
      );

      return distance >= threshold;
    },
    [lastSentLocation]
  );

  // 주기적으로 위치 전송 (walker만)
  useEffect(() => {
    if (!center || role !== "walker" || !webrtcConnected) return;

    // 위치 변경이 충분할 때만 전송
    if (hasLocationChanged(center.lat, center.lng)) {
      console.log("Walker sending location due to significant change");
      const success = sendMyLocation(center.lat, center.lng);
      if (success) {
        setLastSentLocation(center);
      }
    }
  }, [center, role, webrtcConnected, sendMyLocation, hasLocationChanged]);

  // 정기적인 위치 전송 (walker만, 30초마다)
  useEffect(() => {
    if (role !== "walker" || !webrtcConnected) return;

    const interval = setInterval(() => {
      if (center) {
        console.log("Walker sending periodic location update");
        const success = sendMyLocation(center.lat, center.lng);
        if (success) {
          setLastSentLocation(center);
        }
      }
    }, 30000); // 30초마다

    return () => clearInterval(interval);
  }, [role, webrtcConnected, center, sendMyLocation]);

  // Owner는 연결되면 한 번만 위치 전송
  useEffect(() => {
    if (role === "owner" && webrtcConnected && center) {
      console.log("Owner sending initial location");
      sendMyLocation(center.lat, center.lng);
      setLastSentLocation(center);
    }
  }, [role, webrtcConnected, center, sendMyLocation]);

  // 위치 추적 상태 관리
  const toggleLocationTracking = useCallback(() => {
    if (isTracking) {
      stopLocationTracking();
      setIsTracking(false);
    } else {
      startLocationTracking();
      setIsTracking(true);
    }
  }, [isTracking, startLocationTracking, stopLocationTracking]);

  // 수동으로 위치 업데이트
  const handleUpdateLocation = useCallback(() => {
    updateLocationFromGeolocation();
  }, [updateLocationFromGeolocation]);

  // 거리 정보
  const distance = getDistanceToRemote();
  const isNearby = isRemoteNearby(50); // 50미터 반경

  // 연결 상태 표시
  const getConnectionStatus = () => {
    if (!role) return "역할 없음";
    if (!webrtcConnected) return `연결 중... (${connectionState})`;
    return "연결됨";
  };

  // 역할별 UI 텍스트
  const getRoleText = () => {
    switch (role) {
      case "walker":
        return "🚶‍♂️ 산책자";
      case "owner":
        return "🏠 주인";
      default:
        return "👤 대기중";
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 지도 컨테이너 */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* 상태 표시 오버레이 */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "10px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          fontSize: "14px",
          minWidth: "200px",
        }}
      >
        <div>
          <strong>{getRoleText()}</strong>
        </div>
        <div>연결: {getConnectionStatus()}</div>
        {distance !== null && (
          <div>
            거리: {Math.round(distance)}m {isNearby && "🎯"}
          </div>
        )}
        {role === "walker" && (
          <div>추적: {isTracking ? "ON 🟢" : "OFF 🔴"}</div>
        )}
      </div>

      {/* 컨트롤 버튼들 */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={moveToMyLocation}
          style={{
            padding: "10px",
            background: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          📍 내 위치
        </button>

        {remoteLocation && (
          <button
            onClick={moveToRemoteLocation}
            style={{
              padding: "10px",
              background: "#34a853",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            🎯 상대 위치
          </button>
        )}

        <button
          onClick={handleUpdateLocation}
          style={{
            padding: "10px",
            background: "#fbbc04",
            color: "black",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          🔄 위치 갱신
        </button>

        {role === "walker" && (
          <button
            onClick={toggleLocationTracking}
            style={{
              padding: "10px",
              background: isTracking ? "#ea4335" : "#34a853",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {isTracking ? "⏹️ 추적 중지" : "▶️ 추적 시작"}
          </button>
        )}

        <button
          onClick={sendCurrentLocation}
          style={{
            padding: "10px",
            background: "#9aa0a6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          📤 위치 전송
        </button>
      </div>
    </div>
  );
};
