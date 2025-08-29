// store/mapStateStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type WalkerState = {
  center: google.maps.LatLngLiteral;
  zoom: number;
  setCenter: (center: google.maps.LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};

export const useWalkerStateStore = create<WalkerState>()(
  persist(
    (set) => ({
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 17,
      setCenter: (center) => set({ center }),
      setZoom: (zoom) => set({ zoom }),
    }),
    {
      name: "walker-state-storage", // 직렬화 가능한 값만 저장됨
    }
  )
);
