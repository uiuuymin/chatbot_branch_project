import { useMemo } from "react";
import { ReactFlow, Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

// 백엔드가 좌표를 안 주기 때문에 parent-child 관계로 간단한 트리 레이아웃을 직접 계산한다.
function layoutNodes(nodes, edges) {
  const childrenByParent = {};
  const hasParent = new Set();
  edges.forEach((e) => {
    childrenByParent[e.source] = childrenByParent[e.source] || [];
    childrenByParent[e.source].push(e.target);
    hasParent.add(e.target);
  });

  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  const positioned = {};
  let nextX = 0;
  const X_GAP = 220;
  const Y_GAP = 110;

  function visit(id, depth) {
    const children = childrenByParent[id] || [];
    if (children.length === 0) {
      positioned[id] = { x: nextX * X_GAP, y: depth * Y_GAP };
      nextX += 1;
      return positioned[id].x;
    }
    const childXs = children.map((c) => visit(c, depth + 1));
    const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    positioned[id] = { x, y: depth * Y_GAP };
    return x;
  }

  roots.forEach((rootId) => visit(rootId, 0));

  return nodes.map((n) => ({
    id: n.id,
    position: positioned[n.id] || { x: 0, y: 0 },
    data: { label: `${n.label} (${n.message_count})` },
    style: {
      border: n.status === "active" ? "2px solid #4f46e5" : "2px dashed #999",
      opacity: n.status === "deleted" ? 0.4 : 1,
      borderRadius: 8,
      padding: 8,
      background: "#fff",
    },
  }));
}

export default function GraphPanel({ graph, selectedBranchId, onSelectBranch }) {
  const flowNodes = useMemo(() => {
    if (!graph) return [];
    const laidOut = layoutNodes(graph.nodes, graph.edges);
    return laidOut.map((n) => ({
      ...n,
      style: {
        ...n.style,
        border: n.id === selectedBranchId ? "2px solid #16a34a" : n.style.border,
      },
    }));
  }, [graph, selectedBranchId]);

  const flowEdges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: `msg#${e.fork_from_message_id}`,
      animated: true,
    }));
  }, [graph]);

  if (!graph) return <div className="panel-empty">그래프 없음</div>;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={(_, node) => onSelectBranch(node.id)}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
