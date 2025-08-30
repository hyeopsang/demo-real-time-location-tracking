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

    // 채널은 한 번만 생성
    const channel = supabase.channel(roomId);

    // DataChannel 생성
    const dataChannel = peer.createDataChannel("location");
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      console.log("알바 data channel open ✅");
    };
    dataChannel.onclose = () => {
      console.log("알바 data channel closed ❌");
    };
    dataChannel.onmessage = (event) => {
      const loc = JSON.parse(event.data);
      if (loc.role === "walker") {
        setRemoteLocation({ lat: loc.lat, lng: loc.lng });
      }
    };

    // ICE Candidate 수집 및 전송
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("알바 ICE candidate:", event.candidate);
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "candidate", data: event.candidate },
        });
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("알바 connectionState:", peer.connectionState);
    };

    // 시그널 수신
    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const { type, data } = payload;
        if (type === "offer") {
          console.log("알바: offer 수신");
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "answer", data: answer },
          });
        } else if (type === "answer") {
          console.log("알바: answer 수신");
          await peer.setRemoteDescription(data);
        } else if (type === "candidate") {
          console.log("알바: candidate 수신");
          await peer.addIceCandidate(data);
        }
      })
      .subscribe();

    return () => {
      peer.close();
      channel.unsubscribe();
    };
  }, [roomId]);

  const sendLocation = (lat: number, lng: number) => {
    dataChannelRef.current?.send(JSON.stringify({ lat, lng, role }));
  };

  return { sendLocation, remoteLocation };
}
