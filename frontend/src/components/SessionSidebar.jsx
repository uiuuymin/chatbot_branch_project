import { useState } from "react";

export default function SessionSidebar({ sessions, selectedSessionId, onSelect, onCreate }) {
  const [newTitle, setNewTitle] = useState("");

  const handleCreate = () => {
    onCreate(newTitle.trim() || "새 대화");
    setNewTitle("");
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
            onClick={() => onSelect(s.id)}
          >
            {s.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
