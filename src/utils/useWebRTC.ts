import {useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClinet';

export function useWebRTC(roomId: string) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [remoteLocation, setRemoteLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    const peer = new RTCPeerConnection();
    peerRef.current = peer;

    // DataChannel 생성 (호스트 측)
    const dataChannel = peer.createDataChannel('location');
    dataChannel.onmessage = (event) => {
      const loc = JSON.parse(event.data);
      setRemoteLocation(loc);
    };
    dataChannelRef.current = dataChannel;

    // ICE Candidate 이벤트
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {type: 'candidate', data: event.candidate},
        });
      }
    };

    // Supabase Realtime 채널
    const channel = supabase.channel(roomId);
    channel
      .on('broadcast', {event: 'signal'}, async ({payload}) => {
        const {type, data} = payload;
        if (type === 'offer') {
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {type: 'answer', data: answer},
          });
        } else if (type === 'answer') {
          await peer.setRemoteDescription(data);
        } else if (type === 'candidate') {
          await peer.addIceCandidate(data);
        }
      })
      .subscribe();

    return () => {
      peer.close();
      channel.unsubscribe();
    };
  }, [roomId]);

  // 내 위치 전송
  const sendLocation = (lat: number, lng: number) => {
    dataChannelRef.current?.send(JSON.stringify({lat, lng}));
  };

  return {sendLocation, remoteLocation};
}
