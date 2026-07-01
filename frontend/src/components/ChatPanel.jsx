import { useEffect, useRef, useState } from "react";
import { getBranchMessages, sendChat, createBranch, uploadFile, uploadSessionFile, getBranchFiles, getSessionFiles, deleteFile } from "../api";

const MODEL_OPTIONS = [
  { provider: "openai", name: "gpt-4o-mini", label: "OpenAI - GPT-4o mini" },
  { provider: "anthropic", name: "claude-3-5-sonnet-latest", label: "Anthropic - Claude 3.5 Sonnet" },
  { provider: "chatkhu", name: "claude-sonnet-4-6", label: "ChatKHU - Claude Sonnet 4.6" },
  { provider: "chatkhu", name: "gpt-5.4-nano", label: "ChatKHU - GPT-5.4 nano" },
  { provider: "chatkhu", name: "claude-haiku-4-5-20251001", label: "ChatKHU - Claude Haiku 4.5" },
  { provider: "chatkhu", name: "gemini-3.1-flash-lite", label: "ChatKHU - Gemini 3.1 Flash-Lite" },
];

export default function ChatPanel({ sessionId, branchId, onBranchCreated, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [forkName, setForkName] = useState("");
  const [forkTargetMsgId, setForkTargetMsgId] = useState(null);
  const [forkTargetBranchId, setForkTargetBranchId] = useState(null);
  const [modelKey, setModelKey] = useState(`${MODEL_OPTIONS[0].provider}::${MODEL_OPTIONS[0].name}`);
  const [branchFiles, setBranchFiles] = useState([]);
  const [sessionFiles, setSessionFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const branchFileInputRef = useRef(null);
  const sessionFileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const loadMessages = async () => {
    if (!branchId) return;
    const data = await getBranchMessages(branchId, true);
    setMessages(data);
  };

  const loadFiles = async () => {
    if (!sessionId) return;
    const sf = await getSessionFiles(sessionId);
    setSessionFiles(sf);
    if (branchId) {
      const bf = await getBranchFiles(branchId);
      setBranchFiles(bf);
    } else {
      setBranchFiles([]);
    }
  };

  useEffect(() => {
    loadMessages();
    loadFiles();
  }, [branchId, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [provider, model] = modelKey.split("::");

  const handleSend = async () => {
    if (!input.trim() || !branchId) return;
    setSending(true);
    try {
      await sendChat(branchId, input.trim(), provider, model);
      setInput("");
      await loadMessages();
      onMessageSent?.();
    } catch (err) {
      alert("채팅 전송 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleBranchFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !branchId) return;
    setUploading(true);
    try {
      await uploadFile(branchId, file, provider, model);
      await loadFiles();
    } catch (err) {
      alert("파일 업로드 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSessionFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setUploading(true);
    try {
      await uploadSessionFile(sessionId, file, provider, model);
      await loadFiles();
    } catch (err) {
      alert("파일 업로드 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId, isSession) => {
    try {
      await deleteFile(fileId);
      if (isSession) {
        setSessionFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        setBranchFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      alert("파일 삭제 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleFork = async (messageId, messageBranchId) => {
    setForkTargetMsgId(messageId);
    setForkTargetBranchId(messageBranchId);
  };

  const confirmFork = async () => {
    try {
      const branch = await createBranch(sessionId, forkTargetBranchId, forkTargetMsgId, forkName || null);
      setForkTargetMsgId(null);
      setForkTargetBranchId(null);
      setForkName("");
      onBranchCreated(branch);
    } catch (err) {
      alert("브랜치 생성 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const hasFiles = sessionFiles.length > 0 || branchFiles.length > 0;

  if (!branchId) return <div className="panel-empty">브랜치를 선택하세요</div>;

  return (
    <div className="chat-panel">

      {/* ── 파일 헤더: 항상 상단 고정 ── */}
      <div className="file-header">
        <div className="file-header-label">
          📁 첨부 파일
          <span className="file-header-hint">· 📎 브랜치  🌐 세션 전체 공유</span>
        </div>
        <div className="file-header-actions">
          <button
            className="file-upload-btn"
            onClick={() => branchFileInputRef.current?.click()}
            disabled={uploading}
            title="이 브랜치에만 첨부"
          >
            {uploading ? "⏳" : "📎"}
          </button>
          <button
            className="file-upload-btn file-upload-btn--session"
            onClick={() => sessionFileInputRef.current?.click()}
            disabled={uploading}
            title="세션 전체에 공유"
          >
            {uploading ? "⏳" : "🌐"}
          </button>
        </div>
        <input ref={branchFileInputRef} type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.py,.js,.ts,.html,.xml"
          style={{ display: "none" }} onChange={handleBranchFileSelect} />
        <input ref={sessionFileInputRef} type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.py,.js,.ts,.html,.xml"
          style={{ display: "none" }} onChange={handleSessionFileSelect} />
      </div>

      {hasFiles && (
        <div className="file-chip-row">
          {sessionFiles.map((f) => (
            <div key={f.id} className="file-chip file-chip--session" title={f.summary || f.filename}>
              <span className="file-chip-scope">세션</span>
              <span className="file-chip-name">📄 {f.filename}</span>
              <button className="file-chip-del" onClick={() => handleDeleteFile(f.id, true)}>✕</button>
            </div>
          ))}
          {branchFiles.map((f) => (
            <div key={f.id} className="file-chip" title={f.summary || f.filename}>
              <span className="file-chip-name">📄 {f.filename}</span>
              <button className="file-chip-del" onClick={() => handleDeleteFile(f.id, false)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── 메시지 영역 ── */}
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            <div className="chat-bubble-content">{m.content}</div>
            <button className="fork-btn" onClick={() => handleFork(m.id, m.branch_id)} title="이 메시지에서 분기">
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
          <button onClick={() => { setForkTargetMsgId(null); setForkTargetBranchId(null); }}>취소</button>
        </div>
      )}

      {/* ── 입력 영역 ── */}
      <div className="chat-input-row">
        <select
          className="model-select"
          value={modelKey}
          onChange={(e) => setModelKey(e.target.value)}
          disabled={sending}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={`${opt.provider}::${opt.name}`} value={`${opt.provider}::${opt.name}`}>
              {opt.label}
            </option>
          ))}
        </select>
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
