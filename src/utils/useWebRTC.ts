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

    const channel = supabase.channel("doggy");

    // DataChannel 생성
    const dataChannel = peer.createDataChannel("user_location");
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      console.log("DataChannel open ✅");
      alert("DataChannel open ✅");
    };
    dataChannel.onclose = () => {
      console.log("DataChannel closed ❌");
      alert("DataChannel closed ❌");
    };
    dataChannel.onmessage = (e) => {
      const loc = JSON.parse(e.data);
      if (loc.role === "walker") {
        setRemoteLocation({ lat: loc.lat, lng: loc.lng });
        alert(`워커 위치 수신: lat ${loc.lat}, lng ${loc.lng}`);
      }
    };

    // ICE candidate 전송
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "shout",
          payload: { type: "candidate", data: event.candidate },
        });
        alert("ICE candidate 전송 ✅");
      }
    };

    // 시그널 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data } = payload;
        if (type === "offer") {
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "shout",
            payload: { type: "answer", data: answer },
          });
          alert("offer 수신 후 answer 생성 ✅");
        } else if (type === "answer") {
          await peer.setRemoteDescription(data);
          alert("answer 수신 ✅");
        } else if (type === "candidate") {
          await peer.addIceCandidate(data);
          alert("candidate 수신 ✅");
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
    alert(`내 위치 전송: lat ${lat}, lng ${lng}`);
  };

  return { sendLocation, remoteLocation };
}
