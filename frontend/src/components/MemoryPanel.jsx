import { useEffect, useState } from "react";
import { getSessionMemory, updateSessionMemory, extractSessionMemory } from "../api";

export default function MemoryPanel({ sessionId }) {
  const [memory, setMemory] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!sessionId) return;
    const data = await getSessionMemory(sessionId);
    setMemory(data.memory || "");
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateSessionMemory(sessionId, memory);
    } catch (err) {
      alert("메모리 저장 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleExtract = async () => {
    setBusy(true);
    try {
      const data = await extractSessionMemory(sessionId);
      setMemory(data.memory || "");
    } catch (err) {
      alert("자동 추출 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId) return <div className="panel-empty">세션을 선택하세요</div>;

  return (
    <div className="memory-panel">
      <h4>세션 메모리</h4>
      <textarea
        className="memory-textarea"
        value={memory}
        onChange={(e) => setMemory(e.target.value)}
        placeholder="사용자 정보 (이름, 직업, 관심사 등)가 여기에 저장됩니다."
        disabled={busy}
      />
      <div className="bmp-row">
        <button onClick={handleSave} disabled={busy}>저장</button>
        <button onClick={handleExtract} disabled={busy}>대화에서 자동 추출</button>
      </div>
    </div>
  );
}
