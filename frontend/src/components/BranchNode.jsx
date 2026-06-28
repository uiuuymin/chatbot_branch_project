import { memo } from 'react'
import { Handle, Position } from 'reactflow'

const STATUS_COLOR = {
  active: '#4ade80',
  inactive: '#94a3b8',
  deleted: '#f87171',
}

function BranchNode({ data, selected }) {
  const statusColor = STATUS_COLOR[data.status] || '#888'
  const isMergeSelected = data.mergeSelected

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 8,
      border: `2px solid ${isMergeSelected ? '#a855f7' : selected ? '#3b82f6' : '#374151'}`,
      background: isMergeSelected ? '#2e1065' : selected ? '#1e3a5f' : '#1f2937',
      minWidth: 170,
      color: '#f9fafb',
      fontSize: 13,
      boxShadow: (selected || isMergeSelected) ? '0 0 14px rgba(99,102,241,0.5)' : 'none',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'all 0.15s',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555', border: 'none' }} />

      <div style={{ fontWeight: 600, marginBottom: 4, color: '#e2e8f0', fontSize: 13 }}>
        {data.label}
      </div>
      <div style={{ color: '#9ca3af', fontSize: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>💬 {data.message_count}</span>
        <span style={{ color: statusColor }}>● {data.status}</span>
        {data.is_collapsed && <span>▶ 접힘</span>}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#555', border: 'none' }} />
    </div>
  )
}

export default memo(BranchNode)
