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
    dataChannelRef.current = dataChannel;

    // DataChannel 이벤트
    dataChannel.onopen = () => console.log("✅ DataChannel open");
    dataChannel.onclose = () => console.log("❌ DataChannel closed");
    dataChannel.onerror = (err) => console.error("DataChannel error:", err);
    dataChannel.onmessage = (event) => {
      console.log("DataChannel message:", event.data);
      const loc = JSON.parse(event.data);
      if (loc.role === "walker")
        setRemoteLocation({ lat: loc.lat, lng: loc.lng });
    };

    // ICE Candidate
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate:", event.candidate);
        supabase.channel(roomId).send({
          type: "broadcast",
          event: "signal",
          payload: { type: "candidate", data: event.candidate },
        });
      }
    };

    // PeerConnection 상태 변경 로그
    peer.onconnectionstatechange = () => {
      console.log("PeerConnection state:", peer.connectionState);
    };

    // 시그널 수신
    const channel = supabase.channel(roomId);
    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const { type, data } = payload;
        console.log("Received signal:", type, data);
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
