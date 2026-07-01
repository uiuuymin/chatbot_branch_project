import { useState } from "react";

function daysRemaining(deletedAt) {
  if (!deletedAt) return 7;
  const deleted = new Date(deletedAt + "Z");
  const diff = 7 - (Date.now() - deleted.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(diff));
}
import { searchBranches, listTrash, restoreSession, purgeSession } from "../api";

export default function SessionSidebar({
  sessions,
  selectedSessionId,
  onSelect,
  onCreate,
  onDelete,
  onSelectBranch,
}) {
  const [newTitle, setNewTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const handleCreate = () => {
    onCreate(newTitle.trim() || "새 대화");
    setNewTitle("");
  };

  const handleSearch = async () => {
    if (!query.trim() || !selectedSessionId) return;
    setSearching(true);
    try {
      const data = await searchBranches(selectedSessionId, query.trim());
      setResults(data);
    } catch (err) {
      alert("검색 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("이 세션을 휴지통으로 이동할까요?")) return;
    onDelete(sessionId);
  };

  const handleOpenTrash = async () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      setTrashLoading(true);
      try {
        const data = await listTrash();
        setTrashItems(data);
      } catch (err) {
        alert("휴지통 로딩 실패: " + (err.response?.data?.detail || err.message));
      } finally {
        setTrashLoading(false);
      }
    }
  };

  const handleRestore = async (sessionId) => {
    try {
      await restoreSession(sessionId);
      const data = await listTrash();
      setTrashItems(data);
      onDelete(null); // 세션 목록 새로고침 트리거
    } catch (err) {
      alert("복원 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const handlePurge = async (sessionId) => {
    if (!window.confirm("영구 삭제하면 복원이 불가능합니다. 삭제할까요?")) return;
    try {
      await purgeSession(sessionId);
      setTrashItems((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      alert("영구 삭제 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="sidebar">
      <h3>세션</h3>
      <div className="session-create-row">
        <input
          placeholder="새 세션 제목"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button onClick={handleCreate}>+ 생성</button>
      </div>
      <ul className="session-list">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={s.id === selectedSessionId ? "selected" : ""}
            onClick={() => {
              onSelect(s.id);
              setResults(null);
              setQuery("");
            }}
          >
            <span className="session-title">{s.title}</span>
            <button
              className="session-delete-btn"
              title="휴지통으로 이동"
              onClick={(e) => handleDelete(e, s.id)}
            >
              🗑
            </button>
          </li>
        ))}
      </ul>

      <div className="trash-section">
        <button className="trash-toggle-btn" onClick={handleOpenTrash}>
          🗑 휴지통 {showTrash ? "▲" : "▼"}
        </button>
        {showTrash && (
          <div className="trash-list">
            {trashLoading && <p className="bmp-hint">불러오는 중...</p>}
            {!trashLoading && trashItems.length === 0 && (
              <p className="bmp-hint">휴지통이 비어있습니다</p>
            )}
            {trashItems.map((s) => (
              <div key={s.id} className="trash-item">
                <span className="trash-item-title">{s.title}</span>
                <span className="trash-item-date">
                  {daysRemaining(s.deleted_at)}일 후 완전히 삭제
                </span>
                <div className="trash-item-actions">
                  <button onClick={() => handleRestore(s.id)}>복원</button>
                  <button
                    className="danger"
                    onClick={() => handlePurge(s.id)}
                  >
                    영구삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSessionId && (
        <div className="branch-search">
          <h3>브랜치 검색</h3>
          <div className="session-create-row">
            <input
              placeholder="이름 또는 태그로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch} disabled={searching}>검색</button>
          </div>
          {results !== null && (
            <ul className="search-result-list">
              {results.length === 0 && <li className="bmp-hint">결과 없음</li>}
              {results.map((r) => (
                <li key={r.id} onClick={() => onSelectBranch?.(r.id)}>
                  <span className={`status-dot ${r.status}`} />
                  {r.name}
                  {r.tags.length > 0 && (
                    <span className="search-result-tags"> [{r.tags.join(", ")}]</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
