import { useState, useCallback, useEffect } from 'react'
import { api } from './api/client'
import SessionSidebar from './components/SessionSidebar'
import BranchGraph from './components/BranchGraph'
import ChatPanel from './components/ChatPanel'
import MergeModal from './components/MergeModal'

export default function App() {
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [branches, setBranches] = useState([])
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const [messages, setMessages] = useState([])
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelection, setMergeSelection] = useState([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listSessions().then(setSessions).catch(e => setError(e.message))
  }, [])

  const refreshSession = useCallback(async (sessionId) => {
    const [graph, branchList] = await Promise.all([
      api.getGraph(sessionId),
      api.listBranches(sessionId),
    ])
    setGraphData(graph)
    setBranches(branchList)
  }, [])

  const handleSelectSession = useCallback(async (sessionId) => {
    setSelectedSessionId(sessionId)
    setSelectedBranchId(null)
    setMessages([])
    setMergeMode(false)
    setMergeSelection([])
    try {
      await refreshSession(sessionId)
    } catch (e) {
      setError(e.message)
    }
  }, [refreshSession])

  const handleCreateSession = useCallback(async (title) => {
    try {
      const result = await api.createSession(title)
      const updated = await api.listSessions()
      setSessions(updated)
      await handleSelectSession(result.id)
    } catch (e) {
      setError(e.message)
    }
  }, [handleSelectSession])

  const handleSelectBranch = useCallback(async (branchId) => {
    if (mergeMode) {
      setMergeSelection(prev => {
        if (prev.includes(branchId)) return prev.filter(id => id !== branchId)
        if (prev.length >= 2) return [prev[1], branchId]
        return [...prev, branchId]
      })
      return
    }
    setSelectedBranchId(branchId)
    try {
      const msgs = await api.getMessages(branchId, true)
      setMessages(msgs)
    } catch (e) {
      setError(e.message)
    }
  }, [mergeMode])

  const handleSendMessage = useCallback(async (content, modelProvider, modelName) => {
    if (!selectedBranchId || !selectedSessionId) return
    setIsLoading(true)
    try {
      await api.sendMessage({
        branch_id: selectedBranchId,
        message: content,
        model_provider: modelProvider,
        model_name: modelName,
      })
      const [msgs] = await Promise.all([
        api.getMessages(selectedBranchId, true),
        refreshSession(selectedSessionId),
      ])
      setMessages(msgs)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [selectedBranchId, selectedSessionId, refreshSession])

  const handleFork = useCallback(async (messageId, branchName) => {
    if (!selectedBranchId || !selectedSessionId) return
    try {
      const newBranch = await api.createBranch({
        session_id: selectedSessionId,
        parent_branch_id: selectedBranchId,
        fork_from_message_id: messageId,
        name: branchName || undefined,
      })
      await refreshSession(selectedSessionId)
      // 새 브랜치로 이동
      setSelectedBranchId(newBranch.id)
      const msgs = await api.getMessages(newBranch.id, true)
      setMessages(msgs)
    } catch (e) {
      setError(e.message)
    }
  }, [selectedBranchId, selectedSessionId, refreshSession])

  const handleMerge = useCallback(async (params) => {
    setIsLoading(true)
    try {
      const result = await api.merge(params)
      setShowMergeModal(false)
      setMergeMode(false)
      setMergeSelection([])
      await refreshSession(selectedSessionId)
      // 생성된 merge 브랜치로 이동
      setSelectedBranchId(result.branch_id)
      const msgs = await api.getMessages(result.branch_id, true)
      setMessages(msgs)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [selectedSessionId, refreshSession])

  const handleToggleMergeMode = () => {
    setMergeMode(m => !m)
    setMergeSelection([])
  }

  const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name || ''

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 에러 토스트 */}
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 9999,
            background: '#dc2626', color: '#fff', padding: '10px 16px',
            borderRadius: 8, maxWidth: 320, cursor: 'pointer', fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* 왼쪽 — 세션 목록 */}
      <SessionSidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
      />

      {/* 중앙 — 브랜치 그래프 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {selectedSessionId ? (
          <>
            {/* 상단 툴바 */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <button
                onClick={handleToggleMergeMode}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: mergeMode ? '#7c3aed' : '#374151',
                  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {mergeMode ? '✕ Merge 취소' : '⊕ Merge 모드'}
              </button>

              {mergeMode && mergeSelection.length === 2 && (
                <button
                  onClick={() => setShowMergeModal(true)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: '#059669', color: '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  Merge 실행 →
                </button>
              )}

              {mergeMode && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {mergeSelection.length === 0 && '브랜치 2개를 선택하세요'}
                  {mergeSelection.length === 1 && '하나 더 선택하세요'}
                  {mergeSelection.length === 2 && (
                    <>
                      <span style={{ color: '#a78bfa' }}>
                        {branches.find(b => b.id === mergeSelection[0])?.name}
                      </span>
                      {' + '}
                      <span style={{ color: '#a78bfa' }}>
                        {branches.find(b => b.id === mergeSelection[1])?.name}
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>

            <BranchGraph
              graphData={graphData}
              selectedBranchId={selectedBranchId}
              mergeMode={mergeMode}
              mergeSelection={mergeSelection}
              onSelectBranch={handleSelectBranch}
            />
          </>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 12,
            color: '#6b7280',
          }}>
            <div style={{ fontSize: 32 }}>⑂</div>
            <div style={{ fontSize: 15 }}>세션을 선택하거나 새로 만드세요</div>
            <div style={{ fontSize: 12, color: '#4b5563' }}>← 왼쪽 사이드바에서 + 버튼을 누르세요</div>
          </div>
        )}
      </div>

      {/* 오른쪽 — 채팅 패널 */}
      {selectedBranchId && (
        <ChatPanel
          branchId={selectedBranchId}
          branchName={selectedBranchName}
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onFork={handleFork}
        />
      )}

      {/* Merge 모달 */}
      {showMergeModal && (
        <MergeModal
          sessionId={selectedSessionId}
          branches={branches}
          branchId1={mergeSelection[0]}
          branchId2={mergeSelection[1]}
          isLoading={isLoading}
          onMerge={handleMerge}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  )
}
