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

export const mergeBranches = (sessionId, parentBranchIds, name = null) =>
  api
    .post("/branches/merge", {
      session_id: sessionId,
      parent_branch_ids: parentBranchIds,
      name,
    })
    .then((r) => r.data);

export const patchBranch = (branchId, body) =>
  api.patch(`/branches/${branchId}`, body).then((r) => r.data);

export const updateBranchName = (branchId, name) =>
  api.patch(`/branches/${branchId}/name`, { name }).then((r) => r.data);

export const autoNameBranch = (branchId) =>
  api.post(`/branches/${branchId}/auto-name`).then((r) => r.data);

export const autoTagBranch = (branchId) =>
  api.post(`/branches/${branchId}/auto-tag`).then((r) => r.data);

export const listSessionBranches = (sessionId) =>
  api.get(`/sessions/${sessionId}/branches`).then((r) => r.data);

export const searchBranches = (sessionId, q) =>
  api.get(`/sessions/${sessionId}/search`, { params: { q } }).then((r) => r.data);

export const getSessionTags = (sessionId) =>
  api.get(`/sessions/${sessionId}/tags`).then((r) => r.data);

export const getBranchTags = (branchId) =>
  api.get(`/branches/${branchId}/tags`).then((r) => r.data);

export const createTag = (sessionId, name, color = null, type = "normal") =>
  api.post("/tags", { session_id: sessionId, name, color, type }).then((r) => r.data);

export const addBranchTag = (branchId, tagId) =>
  api.post(`/branches/${branchId}/tags`, { tag_id: tagId }).then((r) => r.data);

export const removeBranchTag = (branchId, tagId) =>
  api.delete(`/branches/${branchId}/tags/${tagId}`).then((r) => r.data);

export const getSessionMemory = (sessionId) =>
  api.get(`/sessions/${sessionId}/memory`).then((r) => r.data);

export const updateSessionMemory = (sessionId, memory) =>
  api.patch(`/sessions/${sessionId}/memory`, { memory }).then((r) => r.data);

export const extractSessionMemory = (sessionId) =>
  api.post(`/sessions/${sessionId}/memory/extract`).then((r) => r.data);

export const listBranchTrash = (sessionId) =>
  api.get(`/sessions/${sessionId}/branch-trash`).then((r) => r.data);

export const restoreBranch = (branchId) =>
  api.post(`/branches/${branchId}/restore`).then((r) => r.data);

export const purgeBranch = (branchId) =>
  api.delete(`/branches/${branchId}`);

export const deleteSession = (sessionId) =>
  api.delete(`/sessions/${sessionId}`);

export const listTrash = () => api.get("/trash").then((r) => r.data);

export const restoreSession = (sessionId) =>
  api.post(`/trash/${sessionId}/restore`).then((r) => r.data);

export const purgeSession = (sessionId) =>
  api.delete(`/trash/${sessionId}`);

export default api;
