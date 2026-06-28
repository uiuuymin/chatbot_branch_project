import { useState } from 'react'

export default function SessionSidebar({ sessions, selectedSessionId, onSelectSession, onCreateSession }) {
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleCreate = () => {
    if (!newTitle.trim()) return
    onCreateSession(newTitle.trim())
    setNewTitle('')
    setCreating(false)
  }

  return (
    <div style={{
      width: 210,
      minWidth: 160,
      borderRight: '1px solid #374151',
      display: 'flex',
      flexDirection: 'column',
      background: '#1f2937',
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 16px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: 700,
        fontSize: 13,
        color: '#e2e8f0',
      }}>
        세션
        <button
          onClick={() => setCreating(c => !c)}
          title="새 세션"
          style={{
            fontSize: 20, lineHeight: 1, background: 'none', border: 'none',
            color: creating ? '#ef4444' : '#3b82f6', cursor: 'pointer',
          }}
        >
          {creating ? '✕' : '+'}
        </button>
      </div>

      {/* New session input */}
      {creating && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #374151' }}>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            placeholder="세션 이름"
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 5,
              border: '1px solid #4b5563', background: '#111827', color: '#f9fafb',
              fontSize: 13, marginBottom: 6,
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              width: '100%', padding: 5, borderRadius: 5, border: 'none',
              background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            생성
          </button>
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 && (
          <div style={{ padding: 16, color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
            세션 없음<br />
            <span style={{ fontSize: 11, color: '#4b5563' }}>+ 버튼으로 생성하세요</span>
          </div>
        )}
        {sessions.map(s => {
          const active = s.id === selectedSessionId
          return (
            <div
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                background: active ? '#1e3a5f' : 'transparent',
                borderLeft: `3px solid ${active ? '#3b82f6' : 'transparent'}`,
                fontSize: 13,
                color: active ? '#e2e8f0' : '#9ca3af',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#374151' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {s.title}
            </div>
          )
        })}
      </div>
    </div>
  )
}
