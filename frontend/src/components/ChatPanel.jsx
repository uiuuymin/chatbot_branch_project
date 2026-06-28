import { useState, useRef, useEffect } from 'react'

const MODEL_OPTIONS = [
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { provider: 'chatkhu', model: 'gpt-4o-mini', label: 'ChatKHU / GPT-4o mini' },
]

function Message({ msg, isInherited, branchId, onFork }) {
  const [hovered, setHovered] = useState(false)
  const [forkInput, setForkInput] = useState(false)
  const [forkName, setForkName] = useState('')
  const isUser = msg.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 14,
        opacity: isInherited ? 0.6 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setForkInput(false); setForkName('') }}
    >
      {isInherited && (
        <span style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>
          ↑ 상속된 맥락
        </span>
      )}
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? '#1d4ed8' : '#374151',
          color: '#f9fafb',
          fontSize: 13,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>

      {/* Fork button — 현재 브랜치 메시지에만 표시 */}
      {!isInherited && hovered && (
        <div style={{ marginTop: 4 }}>
          {!forkInput ? (
            <button
              onClick={() => setForkInput(true)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                border: '1px solid #4b5563', background: 'transparent',
                color: '#9ca3af', cursor: 'pointer',
              }}
            >
              ⑂ 여기서 분기
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                autoFocus
                value={forkName}
                onChange={e => setForkName(e.target.value)}
                placeholder="브랜치 이름 (선택)"
                style={{
                  fontSize: 12, padding: '3px 8px', borderRadius: 4,
                  border: '1px solid #4b5563', background: '#1f2937', color: '#f9fafb', width: 140,
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onFork(msg.id, forkName); setForkInput(false); setForkName('') }
                  if (e.key === 'Escape') setForkInput(false)
                }}
              />
              <button
                onClick={() => { onFork(msg.id, forkName); setForkInput(false); setForkName('') }}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 4,
                  border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer',
                }}
              >
                생성
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({ branchId, branchName, messages, isLoading, onSendMessage, onFork }) {
  const [input, setInput] = useState('')
  const [modelIdx, setModelIdx] = useState(0)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    const { provider, model } = MODEL_OPTIONS[modelIdx]
    onSendMessage(input.trim(), provider, model)
    setInput('')
  }

  return (
    <div style={{
      width: 360,
      minWidth: 320,
      borderLeft: '1px solid #374151',
      display: 'flex',
      flexDirection: 'column',
      background: '#111827',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ color: '#3b82f6', fontSize: 16 }}>⑂</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>{branchName}</span>
        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
          {messages.length}개 메시지
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {messages.length === 0 && !isLoading && (
          <div style={{ color: '#6b7280', textAlign: 'center', marginTop: 60, fontSize: 13 }}>
            메시지가 없습니다.<br />
            <span style={{ fontSize: 12, color: '#4b5563' }}>아래에서 대화를 시작하세요.</span>
          </div>
        )}
        {messages.map(msg => (
          <Message
            key={msg.id}
            msg={msg}
            isInherited={msg.branch_id !== branchId}
            branchId={branchId}
            onFork={onFork}
          />
        ))}
        {isLoading && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start', marginBottom: 14,
          }}>
            <div style={{
              padding: '10px 14px', borderRadius: '12px 12px 12px 4px',
              background: '#374151', color: '#9ca3af', fontSize: 20, letterSpacing: 4,
            }}>
              ···
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: 12, borderTop: '1px solid #374151' }}>
        <select
          value={modelIdx}
          onChange={e => setModelIdx(Number(e.target.value))}
          style={{
            width: '100%', marginBottom: 8, padding: '5px 8px', borderRadius: 5,
            border: '1px solid #374151', background: '#1f2937', color: '#9ca3af',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          {MODEL_OPTIONS.map((opt, i) => (
            <option key={i} value={i}>{opt.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="메시지 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
            rows={3}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 6, resize: 'none',
              border: '1px solid #374151', background: '#1f2937', color: '#f9fafb',
              fontSize: 13, lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: input.trim() && !isLoading ? '#3b82f6' : '#374151',
              color: '#fff',
              cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
