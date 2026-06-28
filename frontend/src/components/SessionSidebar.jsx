import { useState } from "react";
import { searchBranches } from "../api";

export default function SessionSidebar({
  sessions,
  selectedSessionId,
  onSelect,
  onCreate,
  onSelectBranch,
}) {
  const [newTitle, setNewTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

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
            {s.title}
          </li>
        ))}
      </ul>

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
