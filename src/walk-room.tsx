import {useEffect} from 'react';
import {useWebRTC} from './utils/useWebRTC';
import {useGoogleMap} from './useGoogleMap';

export default function WalkRoom({roomId}: {roomId: string}) {
  const {remoteLocation} = useWebRTC(roomId); // 산책 알바 위치 수신
  const {mapContainerRef, updateRemoteMarker} = useGoogleMap();

  // 산책 알바 위치 수신 시 지도 업데이트
  useEffect(() => {
    if (!remoteLocation) return;
    updateRemoteMarker(remoteLocation.lat, remoteLocation.lng);
  }, [remoteLocation, updateRemoteMarker]);

  return <div ref={mapContainerRef} style={{width: '100%', height: '100vh'}} />;
}
