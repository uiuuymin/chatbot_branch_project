const BASE = 'http://127.0.0.1:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '오류가 발생했습니다')
  }
  return res.json()
}

export const api = {
  listSessions: () => request('/sessions'),
  createSession: (title) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),

  listBranches: (sessionId) => request(`/sessions/${sessionId}/branches`),
  getGraph: (sessionId, includeInactive = false) =>
    request(`/sessions/${sessionId}/graph?include_inactive=${includeInactive}`),
  createBranch: (data) => request('/branches', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  patchBranch: (branchId, data) => request(`/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getMessages: (branchId, includeInherited = true) =>
    request(`/branches/${branchId}/messages?include_inherited=${includeInherited}`),

  sendMessage: (data) => request('/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  merge: (data) => request('/merge', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}
