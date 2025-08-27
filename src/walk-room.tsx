import {useEffect} from 'react';
import {useWebRTC} from './utils/useWebRTC';
import {useGoogleMap} from './useGoogleMap';

export default function WalkRoom({
  roomId,
  role,
}: {
  roomId: string;
  role: 'walker' | 'owner' | null;
}) {
  const {sendLocation, remoteLocation} = useWebRTC(roomId, role);
  const {mapContainerRef, updateRemoteMarker} = useGoogleMap();

  // 산책 알바 위치 전송 (본인이 walker일 때만)
  useEffect(() => {
    if (role !== 'walker') return;
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        try {
          sendLocation(pos.coords.latitude, pos.coords.longitude);
        } catch (e) {
          console.error('위치 전송 실패:', e);
        }
      },
      (err) => console.error('위치 정보 가져오기 실패:', err),
      {enableHighAccuracy: true}
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [sendLocation, role]);

  // 산책 알바 위치 수신 시 지도 업데이트
  useEffect(() => {
    if (!remoteLocation) return;
    updateRemoteMarker(remoteLocation.lat, remoteLocation.lng);
  }, [remoteLocation, updateRemoteMarker]);

  return <div ref={mapContainerRef} style={{width: '100%', height: '100vh'}} />;
}
