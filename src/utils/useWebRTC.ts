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

    const channel = supabase.channel(roomId, {
      config: {
        broadcast: { self: true, ack: true },
      },
    });

    // DataChannel 생성
    const dataChannel = peer.createDataChannel("user_locations");
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => console.log("DataChannel open ✅");
    dataChannel.onclose = () => console.log("DataChannel closed ❌");
    dataChannel.onmessage = (e) => {
      const loc = JSON.parse(e.data);
      if (loc.role === "walker")
        setRemoteLocation({ lat: loc.lat, lng: loc.lng });
    };

    // ICE candidate 전송
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "candidate", data: event.candidate },
        });
      }
    };

    // 시그널 수신
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

  return { sendLocation, remoteLocation };
}
