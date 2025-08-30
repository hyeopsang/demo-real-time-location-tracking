import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClinet";

type Role = "walker" | "owner" | null;

export function useWebRTC(roomId: string, role: Role) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const [remoteLocation] = useState<{ lat: number; lng: number } | null>(null);

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

    peer.oniceconnectionstatechange = () =>
      console.log("ICE State:", peer.iceConnectionState);
    peer.onsignalingstatechange = () =>
      console.log("Signaling State:", peer.signalingState);

    // ICE Candidate 발생 시
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
    const setupDataChannel = (dc: RTCDataChannel) => {
      dataChannelRef.current = dc;
      dc.onopen = () => console.log(`${role} channel open ✅`);
      dc.onmessage = (msg) => console.log("received msg:", msg.data);
    };

    if (role === "owner") {
      setupDataChannel(peer.createDataChannel("location_channel"));
    } else {
      peer.ondatachannel = (event) => setupDataChannel(event.channel);
    }

    // 시그널링 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data, role: senderRole } = payload;
        if (senderRole === role) return;

        if (type === "offer") {
          await peer.setRemoteDescription(data);
          // Pending candidates 추가
          for (const cand of pendingCandidates.current) {
            await peer.addIceCandidate(cand);
          }
          pendingCandidates.current = [];
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "shout",
            payload: { type: "answer", data: answer, role },
          });
        } else if (type === "answer") {
          await peer.setRemoteDescription(data);
          for (const cand of pendingCandidates.current) {
            await peer.addIceCandidate(cand);
          }
          pendingCandidates.current = [];
        } else if (type === "candidate") {
          // RemoteDescription 세팅 전이면 pending에 저장
          if (!peer.remoteDescription) {
            pendingCandidates.current.push(data);
          } else {
            await peer.addIceCandidate(data);
          }
        }
      })
      .subscribe();

    // Owner가 Offer 생성
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

  const sendLocation = async (lat: number, lng: number) => {
    const channel = dataChannelRef.current;
    if (!channel) return;
    await waitForOpenChannel(channel);
    channel.send(JSON.stringify({ lat, lng, role }));
  };

  return { sendLocation, remoteLocation };
}
