import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { patchBranch, mergeBranches } from "../api";
import BranchManagePanel from "./BranchManagePanel";

// 백엔드가 좌표를 안 주기 때문에 직접 레이아웃을 계산한다.
// 머지 브랜치는 부모가 여러 개라 트리가 아니라 DAG이므로, "가장 먼 부모로부터의 거리"를 depth로 두고
// 같은 depth끼리 가로로 나열하는 단순한 레이어 레이아웃을 쓴다.
function computePositions(nodes, edges) {
  const parentsOf = {};
  nodes.forEach((n) => { parentsOf[n.id] = []; });
  edges.forEach((e) => {
    parentsOf[e.target] = parentsOf[e.target] || [];
    parentsOf[e.target].push(e.source);
  });

  const depth = {};
  function computeDepth(id, guard) {
    if (depth[id] !== undefined) return depth[id];
    if (guard.has(id)) return 0; // 순환 방지 (정상 데이터에서는 발생하지 않음)
    guard.add(id);
    const parents = parentsOf[id] || [];
    depth[id] = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => computeDepth(p, guard)));
    return depth[id];
  }
  nodes.forEach((n) => computeDepth(n.id, new Set()));

  const X_GAP = 220;
  const Y_GAP = 110;
  const countByDepth = {};
  const positioned = {};
  nodes.forEach((n) => {
    const d = depth[n.id] || 0;
    const i = countByDepth[d] || 0;
    countByDepth[d] = i + 1;
    positioned[n.id] = { x: i * X_GAP, y: d * Y_GAP };
  });
  return positioned;
}

export default function GraphPanel({ graph, sessionId, selectedBranchId, onSelectBranch, onChanged, onBranchCreated }) {
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeName, setMergeName] = useState("");
  const [merging, setMerging] = useState(false);

  const positions = useMemo(() => {
    if (!graph) return {};
    return computePositions(graph.nodes, graph.edges);
  }, [graph]);

  const handleToggleCollapse = async (branchId, next) => {
    try {
      await patchBranch(branchId, { is_collapsed: next });
      onChanged?.();
    } catch (err) {
      alert("접힘 상태 변경 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const exitMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge([]);
    setMergeName("");
  };

  const handleNodeClick = (branchId) => {
    if (!mergeMode) {
      onSelectBranch(branchId);
      return;
    }
    setSelectedForMerge((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const confirmMerge = async () => {
    setMerging(true);
    try {
      const branch = await mergeBranches(sessionId, selectedForMerge, mergeName.trim() || null);
      exitMergeMode();
      onBranchCreated?.(branch);
    } catch (err) {
      alert("브랜치 머지 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setMerging(false);
    }
  };

  const flowNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((n) => {
      const isMergeSelected = selectedForMerge.includes(n.id);
      return {
        id: n.id,
        position: positions[n.id] || { x: 0, y: 0 },
        data: {
          label: (
            <div className="graph-node-label">
              <div className="graph-node-title">
                {n.is_merge && "🔀 "}
                {n.label}
              </div>
              <div className="graph-node-meta">
                <span className={`status-dot ${n.status}`} />
                msg {n.message_count}
              </div>
              {n.is_collapsed && (
                <button
                  className="graph-node-expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleCollapse(n.id, false);
                  }}
                  title="하위 브랜치 펼치기"
                >
                  📂 펼치기
                </button>
              )}
            </div>
          ),
        },
        style: {
          border: isMergeSelected
            ? "2px solid #ea580c"
            : n.id === selectedBranchId
            ? "2px solid #16a34a"
            : n.status === "active"
            ? "2px solid #4f46e5"
            : "2px dashed #999",
          opacity: n.status === "deleted" ? 0.4 : 1,
          borderRadius: 8,
          padding: 8,
          background: isMergeSelected ? "#ffedd5" : n.is_collapsed ? "#fef9c3" : "#fff",
        },
      };
    });
  }, [graph, positions, selectedBranchId, selectedForMerge]);

  const flowEdges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.type === "merge" ? "병합" : `msg#${e.fork_from_message_id}`,
      animated: true,
      style: e.type === "merge" ? { stroke: "#ea580c" } : undefined,
    }));
  }, [graph]);

  if (!graph) return <div className="panel-empty">그래프 없음</div>;

  return (
    <div className="graph-panel-split">
      <div className="graph-canvas-wrap">
        <div className="graph-toolbar">
          {!mergeMode ? (
            <button onClick={() => setMergeMode(true)}>🔀 병합 모드</button>
          ) : (
            <>
              <span className="bmp-hint">병합할 브랜치를 클릭하세요 ({selectedForMerge.length}개 선택)</span>
              <button onClick={exitMergeMode} disabled={merging}>취소</button>
            </>
          )}
        </div>
        {mergeMode && selectedForMerge.length >= 2 && (
          <div className="fork-modal">
            <span>{selectedForMerge.length}개 브랜치 병합</span>
            <input
              placeholder="브랜치 이름 (선택, 비우면 자동 생성)"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              disabled={merging}
            />
            <button onClick={confirmMerge} disabled={merging}>병합</button>
          </div>
        )}
        <div className="graph-flow-wrap">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={(_, node) => handleNodeClick(node.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
      <div className="graph-detail-wrap">
        <BranchManagePanel
          sessionId={sessionId}
          branchId={selectedBranchId}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
