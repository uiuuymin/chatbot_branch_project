import { useState } from 'react'

const inp = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #374151', background: '#111827', color: '#f9fafb',
  fontSize: 13, marginBottom: 12,
}
const lbl = {
  display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4,
}

export default function MergeModal({
  sessionId, branches, branchId1, branchId2,
  isLoading, onMerge, onClose,
}) {
  const active = branches.filter(b => b.status === 'active')

  const [parentBranchId, setParentBranchId] = useState(active[0]?.id || '')
  const [forkMsgId, setForkMsgId] = useState(active[0]?.head_id ?? '')
  const [name, setName] = useState('')
  const [modelProvider, setModelProvider] = useState('openai')
  const [modelName, setModelName] = useState('gpt-4o')

  const handleParentChange = (id) => {
    setParentBranchId(id)
    const b = branches.find(x => x.id === id)
    setForkMsgId(b?.head_id ?? '')
  }

  const handleSubmit = () => {
    if (!parentBranchId || !forkMsgId) return
    onMerge({
      branch_id_1: branchId1,
      branch_id_2: branchId2,
      session_id: sessionId,
      parent_branch_id: parentBranchId,
      fork_from_message_id: Number(forkMsgId),
      name: name.trim() || undefined,
      model_provider: modelProvider,
      model_name: modelName,
    })
  }

  const name1 = branches.find(b => b.id === branchId1)?.name || branchId1?.slice(0, 8)
  const name2 = branches.find(b => b.id === branchId2)?.name || branchId2?.slice(0, 8)
  const selectedParentHeadId = branches.find(b => b.id === parentBranchId)?.head_id

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#1f2937', borderRadius: 12, border: '1px solid #374151',
        padding: 24, width: 460, maxWidth: '92vw',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>⊕ 브랜치 Merge</h2>

        {/* 선택된 브랜치 표시 */}
        <div style={{
          marginBottom: 18, padding: 12, background: '#111827',
          borderRadius: 8, fontSize: 13, color: '#9ca3af',
          display: 'flex', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>브랜치 1</div>
            <div style={{ color: '#a78bfa', fontWeight: 600 }}>{name1}</div>
          </div>
          <div style={{ color: '#4b5563', alignSelf: 'center', fontSize: 16 }}>+</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>브랜치 2</div>
            <div style={{ color: '#a78bfa', fontWeight: 600 }}>{name2}</div>
          </div>
        </div>

        <label style={lbl}>Merge 결과 브랜치 이름 (선택)</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="비워두면 자동 생성"
          style={inp}
        />

        <label style={lbl}>Fork 위치 — 부모 브랜치</label>
        <select
          value={parentBranchId}
          onChange={e => handleParentChange(e.target.value)}
          style={{ ...inp, cursor: 'pointer' }}
        >
          {active.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label style={lbl}>Fork 메시지 ID</label>
        <input
          type="number"
          value={forkMsgId}
          onChange={e => setForkMsgId(e.target.value)}
          style={inp}
        />
        {selectedParentHeadId != null && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: -10, marginBottom: 12 }}>
            선택 브랜치 마지막 메시지: #{selectedParentHeadId}
          </div>
        )}

        <label style={lbl}>모델</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <select
            value={modelProvider}
            onChange={e => setModelProvider(e.target.value)}
            style={{ ...inp, marginBottom: 0, flex: 1, cursor: 'pointer' }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="chatkhu">ChatKHU</option>
          </select>
          <input
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            placeholder="모델명"
            style={{ ...inp, marginBottom: 0, flex: 2 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 6,
              border: '1px solid #374151', background: 'transparent',
              color: '#9ca3af', cursor: 'pointer', fontSize: 14,
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !parentBranchId || !forkMsgId}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 6, border: 'none',
              background: isLoading || !parentBranchId || !forkMsgId ? '#374151' : '#7c3aed',
              color: '#fff',
              cursor: isLoading || !parentBranchId || !forkMsgId ? 'default' : 'pointer',
              fontWeight: 600, fontSize: 14,
            }}
          >
            {isLoading ? 'Merge 실행 중...' : 'Merge 실행'}
          </button>
        </div>
      </div>
    </div>
  )
}
