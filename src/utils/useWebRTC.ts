import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClinet";

type Role = "walker" | "owner" | null;

export function useWebRTC(roomId: string, role: Role) {
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
    const dataChannel = peer.createDataChannel("location");
    dataChannel.onmessage = (event) => {
      const loc = JSON.parse(event.data);
      // 산책 알바 위치만 수신
      if (loc.role === "walker") {
        setRemoteLocation({ lat: loc.lat, lng: loc.lng });
      }
    };
    dataChannelRef.current = dataChannel;

    // ICE Candidate
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(roomId).send({
          type: "broadcast",
          event: "signal",
          payload: { type: "candidate", data: event.candidate },
        });
      }
    };

    // 시그널 수신
    const channel = supabase.channel(roomId);
    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const { type, data } = payload;
        if (type === "offer") {
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "answer", data: answer },
          });
        } else if (type === "answer") {
          await peer.setRemoteDescription(data);
        } else if (type === "candidate") {
          await peer.addIceCandidate(data);
        }
      })
      .subscribe();

    return () => {
      peer.close();
      channel.unsubscribe();
    };
  }, [roomId]);

  // 위치 전송
  const sendLocation = (lat: number, lng: number) => {
    dataChannelRef.current?.send(JSON.stringify({ lat, lng, role }));
  };
  console.log(peerRef.current?.connectionState);
  console.log(dataChannelRef.current?.readyState);
  return { sendLocation, remoteLocation };
}
