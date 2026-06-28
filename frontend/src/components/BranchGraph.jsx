import { useEffect, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import BranchNode from './BranchNode'

const NODE_W = 200
const NODE_H = 70

function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })
}

const nodeTypes = { branch: BranchNode }

export default function BranchGraph({
  graphData,
  selectedBranchId,
  mergeMode,
  mergeSelection,
  onSelectBranch,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!graphData.nodes.length) {
      setNodes([])
      setEdges([])
      return
    }

    const rfNodes = graphData.nodes.map(n => ({
      id: n.id,
      type: 'branch',
      data: {
        label: n.label,
        status: n.status,
        message_count: n.message_count,
        is_collapsed: n.is_collapsed,
        mergeSelected: mergeSelection.includes(n.id),
      },
      position: { x: 0, y: 0 },
    }))

    const rfEdges = graphData.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
      style: { stroke: '#4b5563', strokeWidth: 2 },
      label: e.fork_from_message_id ? `#${e.fork_from_message_id}` : '',
      labelStyle: { fill: '#6b7280', fontSize: 10 },
      labelBgStyle: { fill: '#111827', fillOpacity: 0.8 },
    }))

    const layoutedNodes = applyDagreLayout(rfNodes, rfEdges)
    setNodes(layoutedNodes)
    setEdges(rfEdges)
  }, [graphData, mergeSelection])

  const onNodeClick = useCallback((_, node) => {
    onSelectBranch(node.id)
  }, [onSelectBranch])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          selected: n.id === selectedBranchId && !mergeMode,
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#374151" gap={24} size={1} />
        <Controls
          style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          showInteractive={false}
        />
        <MiniMap
          style={{ background: '#1f2937', border: '1px solid #374151' }}
          nodeColor={n => {
            if (n.data?.mergeSelected) return '#a855f7'
            if (n.data?.status === 'active') return '#4ade80'
            return '#94a3b8'
          }}
          maskColor="rgba(0,0,0,0.4)"
        />
      </ReactFlow>
    </div>
  )
}
