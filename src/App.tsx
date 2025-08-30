import { useState } from "react";
import { WalkRoom } from "./walk-room";

function App() {
  const [role, setRole] = useState<"walker" | "owner" | null>(null);
  const roomId = "room-123"; // WebRTC 룸 ID

  // 역할 선택 후 WalkRoom 렌더링
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>역할을 선택하세요</h2>
        <button
          style={{ margin: "10px", padding: "10px 20px" }}
          onClick={() => setRole("walker")}
        >
          워커
        </button>
        <button
          style={{ margin: "10px", padding: "10px 20px" }}
          onClick={() => setRole("owner")}
        >
          오너
        </button>
      </div>
      <WalkRoom roomId={roomId} role={role} />
    </div>
  );
}

export default App;
