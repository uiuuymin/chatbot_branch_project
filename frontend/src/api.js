import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export const createSession = (title) =>
  api.post("/sessions", { title }).then((r) => r.data);

export const listSessions = () => api.get("/sessions").then((r) => r.data);

export const updateSessionTitle = (sessionId, title) =>
  api.patch(`/sessions/${sessionId}/title`, { title }).then((r) => r.data);

export const getSessionGraph = (sessionId, includeInactive = false) =>
  api
    .get(`/sessions/${sessionId}/graph`, {
      params: { include_inactive: includeInactive },
    })
    .then((r) => r.data);

export const getBranchMessages = (branchId, includeInherited = true) =>
  api
    .get(`/branches/${branchId}/messages`, {
      params: { include_inherited: includeInherited },
    })
    .then((r) => r.data);

export const sendChat = (branchId, message, modelProvider = "openai", modelName = "gpt-4o-mini") =>
  api
    .post("/chat", {
      branch_id: branchId,
      message,
      model_provider: modelProvider,
      model_name: modelName,
    })
    .then((r) => r.data);

export const createBranch = (sessionId, parentBranchId, forkFromMessageId, name = null) =>
  api
    .post("/branches", {
      session_id: sessionId,
      parent_branch_id: parentBranchId,
      fork_from_message_id: forkFromMessageId,
      name,
    })
    .then((r) => r.data);

export const patchBranch = (branchId, body) =>
  api.patch(`/branches/${branchId}`, body).then((r) => r.data);

export const getSessionMemory = (sessionId) =>
  api.get(`/sessions/${sessionId}/memory`).then((r) => r.data);

export default api;
