import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClinet";

type Role = "walker" | "owner" | null;

export function useWebRTC(roomId: string, role: Role) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [remoteLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = peer;

    const channel = supabase.channel(roomId);

    // 로그용 이벤트
    peer.oniceconnectionstatechange = () =>
      console.log("ICE State:", peer.iceConnectionState);
    peer.onsignalingstatechange = () =>
      console.log("Signaling State:", peer.signalingState);

    // candidate 발생 시 전송
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "shout",
          payload: { type: "candidate", data: event.candidate, role },
        });
      }
    };

    // DataChannel 준비
    if (role === "owner") {
      const dc = peer.createDataChannel("location_channel");
      dataChannelRef.current = dc;
      dc.onopen = () => console.log("Owner channel open ✅");
    } else {
      peer.ondatachannel = (event) => {
        const dc = event.channel;
        dataChannelRef.current = dc;
        dc.onopen = () => console.log("Worker channel open ✅");
      };
    }

    // 시그널링 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data, role: senderRole } = payload;
        if (senderRole === role) return; // 내 메시지는 무시

        if (type === "offer") {
          // remote offer 세팅 → answer 생성
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "shout",
            payload: { type: "answer", data: answer, role },
          });
        } else if (type === "answer") {
          // remote answer 세팅
          await peer.setRemoteDescription(data);
        } else if (type === "candidate") {
          // candidate 추가
          await peer.addIceCandidate(data);
        }
      })
      .subscribe();

    // Offer 생성 및 전송 (owner만)
    if (role === "owner") {
      (async () => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        channel.send({
          type: "broadcast",
          event: "shout",
          payload: { type: "offer", data: offer, role },
        });
      })();
    }

    return () => {
      peer.close();
      channel.unsubscribe();
    };
  }, [roomId, role]);

  const waitForOpenChannel = (channel: RTCDataChannel) =>
    new Promise<void>((resolve) => {
      if (channel.readyState === "open") return resolve();
      channel.onopen = () => resolve();
    });

  // 위치 전송
  const sendLocation = async (lat: number, lng: number) => {
    const channel = dataChannelRef.current;
    if (!channel) return;
    await waitForOpenChannel(channel);
    channel.send(JSON.stringify({ lat, lng, role }));
  };

  return { sendLocation, remoteLocation };
}
