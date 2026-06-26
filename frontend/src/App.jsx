import { useEffect, useState } from "react";
import { listSessions, createSession, getSessionGraph } from "./api";
import SessionSidebar from "./components/SessionSidebar";
import ChatPanel from "./components/ChatPanel";
import GraphPanel from "./components/GraphPanel";
import "./App.css";

function findRootBranchId(graph) {
  if (!graph || graph.nodes.length === 0) return null;
  const targets = new Set(graph.edges.map((e) => e.target));
  const root = graph.nodes.find((n) => !targets.has(n.id));
  return root ? root.id : graph.nodes[0].id;
}

function App() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [graph, setGraph] = useState(null);
  const [branchId, setBranchId] = useState(null);

  const refreshSessions = async () => {
    const data = await listSessions();
    setSessions(data);
  };

  const refreshGraph = async (sid) => {
    if (!sid) return;
    const g = await getSessionGraph(sid);
    setGraph(g);
    return g;
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const handleSelectSession = async (sid) => {
    setSessionId(sid);
    const g = await refreshGraph(sid);
    setBranchId(findRootBranchId(g));
  };

  const handleCreateSession = async (title) => {
    const created = await createSession(title);
    await refreshSessions();
    setSessionId(created.id);
    setBranchId(created.main_branch_id);
    await refreshGraph(created.id);
  };

  const handleBranchCreated = async (branch) => {
    await refreshGraph(sessionId);
    setBranchId(branch.id);
  };

  const handleSelectBranch = (id) => setBranchId(id);

  // 채팅 메시지가 추가되면 그래프의 message_count도 갱신해야 한다.
  const handleMessageSent = () => refreshGraph(sessionId);

  return (
    <div className="app-layout">
      <SessionSidebar
        sessions={sessions}
        selectedSessionId={sessionId}
        onSelect={handleSelectSession}
        onCreate={handleCreateSession}
      />
      <div className="chat-area">
        <ChatPanel
          sessionId={sessionId}
          branchId={branchId}
          onBranchCreated={handleBranchCreated}
          onMessageSent={handleMessageSent}
        />
      </div>
      <div className="graph-area">
        <GraphPanel
          graph={graph}
          selectedBranchId={branchId}
          onSelectBranch={handleSelectBranch}
        />
      </div>
    </div>
  );
}

export default App;
