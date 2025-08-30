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

    // Supabase 채널 하나
    const channel = supabase.channel(roomId);

    // 역할에 따라 DataChannel 생성
    if (role === "owner") {
      const dataChannel = peer.createDataChannel("location_channel");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => console.log("Owner DataChannel open ✅");
      dataChannel.onclose = () => console.log("Owner DataChannel closed ❌");
      dataChannel.onerror = (err) =>
        console.log("Owner DataChannel Error:", err);
    } else {
      // 워커는 DataChannel을 peer.ondatachannel로 받음
      peer.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        event.channel.onmessage = (e) => {
          const loc = JSON.parse(e.data);
          if (loc.role === "walker")
            setRemoteLocation({ lat: loc.lat, lng: loc.lng });
        };
        event.channel.onopen = () => console.log("Worker DataChannel open ✅");
        event.channel.onclose = () =>
          console.log("Worker DataChannel closed ❌");
      };
    }

    // ICE Candidate
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "shout",
          payload: { type: "candidate", data: event.candidate, role },
        });
      }
    };

    // 시그널 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data, role: senderRole } = payload;

        // 자신이 보낸 시그널은 무시
        if (senderRole === role) return;

        if (type === "offer") {
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "shout",
            payload: { type: "answer", data: answer, role },
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
  }, [roomId, role]);

  // 위치 전송
  const sendLocation = (lat: number, lng: number) => {
    dataChannelRef.current?.send(JSON.stringify({ lat, lng, role }));
  };

  return { sendLocation, remoteLocation };
}
