import { useEffect, useRef, useState } from "react";
import { getBranchMessages, sendChat, createBranch } from "../api";

export default function ChatPanel({ sessionId, branchId, onBranchCreated, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [forkName, setForkName] = useState("");
  const [forkTargetMsgId, setForkTargetMsgId] = useState(null);
  const bottomRef = useRef(null);

  const loadMessages = async () => {
    if (!branchId) return;
    const data = await getBranchMessages(branchId, true);
    setMessages(data);
  };

  useEffect(() => {
    loadMessages();
  }, [branchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !branchId) return;
    setSending(true);
    try {
      await sendChat(branchId, input.trim());
      setInput("");
      await loadMessages();
      onMessageSent?.();
    } catch (err) {
      alert("채팅 전송 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleFork = async (messageId) => {
    setForkTargetMsgId(messageId);
  };

  const confirmFork = async () => {
    try {
      const branch = await createBranch(sessionId, branchId, forkTargetMsgId, forkName || null);
      setForkTargetMsgId(null);
      setForkName("");
      onBranchCreated(branch);
    } catch (err) {
      alert("브랜치 생성 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  if (!branchId) return <div className="panel-empty">브랜치를 선택하세요</div>;

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            <div className="chat-bubble-content">{m.content}</div>
            <button className="fork-btn" onClick={() => handleFork(m.id)} title="이 메시지에서 분기">
              🌿 분기
            </button>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {forkTargetMsgId !== null && (
        <div className="fork-modal">
          <span>메시지 #{forkTargetMsgId}에서 새 브랜치 생성</span>
          <input
            placeholder="브랜치 이름 (선택, 비우면 자동 생성)"
            value={forkName}
            onChange={(e) => setForkName(e.target.value)}
          />
          <button onClick={confirmFork}>생성</button>
          <button onClick={() => setForkTargetMsgId(null)}>취소</button>
        </div>
      )}

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="메시지를 입력하세요"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending}>
          {sending ? "전송 중..." : "전송"}
        </button>
      </div>
    </div>
  );
}
