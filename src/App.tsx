import {useState} from 'react';
import WalkRoom from './walk-room';

function App() {
  const [role, setRole] = useState<'walker' | 'owner' | null>(null);

  // 역할 선택 후 WalkRoom 렌더링
  return (
    <div style={{width: '100%', height: '100vh'}}>
      <WalkRoom roomId="test" role={role} />
      <div style={{textAlign: 'center', marginTop: '50px'}}>
        <h2>역할을 선택하세요</h2>
        <button onClick={() => setRole('owner')} style={{marginRight: 20}}>
          보호자
        </button>
        <button onClick={() => setRole('walker')}>산책 알바</button>
      </div>
    </div>
  );
}

export default App;
