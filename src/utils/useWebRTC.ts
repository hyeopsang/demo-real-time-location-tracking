import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClinet";

type Role = "walker" | "owner" | null;

export function useWebRTC(roomId: string, role: Role) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const channelReady = useRef<Promise<void> | null>(null);
  const channelReadyResolve = useRef<(() => void) | null>(null);

  const [remoteLocation, setRemoteLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [connectionState, setConnectionState] = useState<string>("new");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!roomId || !role) return;

    console.log(`${role} initializing WebRTC connection...`);

    // DataChannel 세팅 함수
    const setupDataChannel = (dc: RTCDataChannel) => {
      console.log(`${role} setting up data channel`);
      dataChannelRef.current = dc;

      // Promise 초기화
      if (!channelReady.current) {
        channelReady.current = new Promise<void>((resolve) => {
          channelReadyResolve.current = resolve;
          if (dc.readyState === "open") {
            resolve();
            channelReadyResolve.current = null;
          }
        });
      }

      dc.onopen = () => {
        console.log(`${role} data channel opened ✅`);
        setIsConnected(true);
        if (channelReadyResolve.current) {
          channelReadyResolve.current();
          channelReadyResolve.current = null;
        }
      };

      dc.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.log(`${role} received message:`, data);
          if ("lat" in data && "lng" in data) {
            setRemoteLocation({ lat: data.lat, lng: data.lng });
          }
        } catch (e) {
          console.error("Invalid message:", msg.data, e);
        }
      };

      dc.onclose = () => {
        console.log(`${role} data channel closed ❌`);
        setIsConnected(false);
      };

      dc.onerror = (e) => {
        console.error(`${role} data channel error:`, e);
        setIsConnected(false);
      };
    };

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
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

    // 연결 상태 모니터링
    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log(`${role} ICE State:`, state);
      setConnectionState(state);

      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        setIsConnected(false);
        console.warn(`${role} ICE connection ${state}`);
      } else if (state === "connected" || state === "completed") {
        console.log(`${role} ICE connection established ✅`);
      }
    };

    peer.onsignalingstatechange = () => {
      console.log(`${role} Signaling State:`, peer.signalingState);
    };

    peer.onconnectionstatechange = () => {
      console.log(`${role} Connection State:`, peer.connectionState);
    };

    // ICE Candidate 발생 시
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`${role} sending ICE candidate`);
        channel.send({
          type: "broadcast",
          event: "shout",
          payload: { type: "candidate", data: event.candidate, role },
        });
      } else {
        console.log(`${role} ICE gathering completed`);
      }
    };

    // DataChannel 준비
    if (role === "owner") {
      console.log("Owner creating data channel...");
      const dataChannel = peer.createDataChannel("location_channel", {
        ordered: true,
      });
      setupDataChannel(dataChannel);
    } else {
      console.log("Walker waiting for data channel...");
      peer.ondatachannel = (event) => {
        console.log("Walker received data channel");
        setupDataChannel(event.channel);
      };
    }

    // 시그널링 수신
    channel
      .on("broadcast", { event: "shout" }, async ({ payload }) => {
        const { type, data, role: senderRole } = payload;

        // 자신이 보낸 메시지는 무시
        if (senderRole === role) {
          console.log(`${role} ignoring own message`);
          return;
        }

        console.log(`${role} received ${type} from ${senderRole}`);

        try {
          if (type === "offer") {
            console.log(`${role} processing offer...`);
            await peer.setRemoteDescription(new RTCSessionDescription(data));

            // Pending candidates 처리
            console.log(
              `${role} adding ${pendingCandidates.current.length} pending candidates`
            );
            for (const candidate of pendingCandidates.current) {
              try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn(`${role} failed to add pending candidate:`, e);
              }
            }
            pendingCandidates.current = [];

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            console.log(`${role} sending answer...`);
            channel.send({
              type: "broadcast",
              event: "shout",
              payload: { type: "answer", data: answer, role },
            });
          } else if (type === "answer") {
            console.log(`${role} processing answer...`);
            await peer.setRemoteDescription(new RTCSessionDescription(data));

            // Pending candidates 처리
            console.log(
              `${role} adding ${pendingCandidates.current.length} pending candidates`
            );
            for (const candidate of pendingCandidates.current) {
              try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn(`${role} failed to add pending candidate:`, e);
              }
            }
            pendingCandidates.current = [];
          } else if (type === "candidate") {
            if (!peer.remoteDescription) {
              console.log(
                `${role} queueing candidate (no remote description yet)`
              );
              pendingCandidates.current.push(data);
            } else {
              try {
                console.log(`${role} adding ICE candidate`);
                await peer.addIceCandidate(new RTCIceCandidate(data));
              } catch (e) {
                console.warn(`${role} failed to add ICE candidate:`, e);
              }
            }
          }
        } catch (e) {
          console.error(`${role} signaling error:`, e);
        }
      })
      .subscribe();

    // Owner가 Offer 생성 (약간의 지연 추가)
    if (role === "owner") {
      setTimeout(async () => {
        try {
          console.log("Owner creating offer...");
          const offer = await peer.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
          });
          await peer.setLocalDescription(offer);

          console.log("Owner sending offer...");
          channel.send({
            type: "broadcast",
            event: "shout",
            payload: { type: "offer", data: offer, role },
          });
        } catch (e) {
          console.error("Owner failed to create/send offer:", e);
        }
      }, 1000);
    }

    return () => {
      console.log(`${role} cleaning up...`);
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
      channel.unsubscribe();
      channelReady.current = null;
      channelReadyResolve.current = null;
      setIsConnected(false);
    };
  }, [roomId, role]);

  const waitForOpenChannel = async () => {
    if (channelReady.current) {
      try {
        await channelReady.current;
      } catch (e) {
        console.error("Failed to wait for channel:", e);
        throw e;
      }
    }
  };

  const sendLocation = async (lat: number, lng: number) => {
    const dc = dataChannelRef.current;
    if (!dc) {
      console.warn(`${role} no data channel available`);
      return false;
    }

    try {
      await waitForOpenChannel();
      if (dc.readyState === "open") {
        dc.send(JSON.stringify({ lat, lng, role }));
        console.log(`${role} sent location: ${lat}, ${lng}`);
        return true;
      } else {
        console.warn(`${role} data channel not open: ${dc.readyState}`);
        return false;
      }
    } catch (e) {
      console.error(`${role} failed to send location:`, e);
      return false;
    }
  };

  return {
    sendLocation,
    remoteLocation,
    connectionState,
    isConnected,
  };
}
