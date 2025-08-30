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
  const [remoteConnected, setRemoteConnected] = useState(false); // 상대 연결 여부

  useEffect(() => {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "401c6ad59fbd6eb949f8363e",
          credential: "2xfL/LLRw0iGnDP8",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "401c6ad59fbd6eb949f8363e",
          credential: "2xfL/LLRw0iGnDP8",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "401c6ad59fbd6eb949f8363e",
          credential: "2xfL/LLRw0iGnDP8",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "401c6ad59fbd6eb949f8363e",
          credential: "2xfL/LLRw0iGnDP8",
        },
      ],
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

      dc.onopen = () => {
        console.log("Owner channel open ✅");
        setRemoteConnected(true); // 상대가 연결되었음을 표시
      };
      dc.onclose = () => setRemoteConnected(false);
    } else {
      peer.ondatachannel = (event) => {
        const dc = event.channel;
        dataChannelRef.current = dc;

        dc.onopen = () => {
          console.log("Worker channel open ✅");
          setRemoteConnected(true); // 상대가 연결되었음을 표시
        };
        dc.onclose = () => setRemoteConnected(false);

        dc.onmessage = (e) => {
          const loc = JSON.parse(e.data);
          if (loc.role === "walker")
            setRemoteLocation({ lat: loc.lat, lng: loc.lng });
        };
      };
    }

    // 시그널링 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data, role: senderRole } = payload;
        if (senderRole === role) return; // 내 메시지는 무시

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

  return { sendLocation, remoteLocation, remoteConnected };
}
