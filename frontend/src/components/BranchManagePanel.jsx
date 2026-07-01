import { useEffect, useState } from "react";
import {
  patchBranch,
  updateBranchName,
  autoNameBranch,
  autoTagBranch,
  getBranchTags,
  getSessionTags,
  createTag,
  addBranchTag,
  removeBranchTag,
  listSessionBranches,
  listBranchTrash,
  restoreBranch,
  purgeBranch,
} from "../api";

function daysRemaining(deletedAt) {
  if (!deletedAt) return 7;
  const deleted = new Date(deletedAt + "Z");
  const diff = 7 - (Date.now() - deleted.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(diff));
}

export default function BranchManagePanel({ sessionId, branchId, onChanged }) {
  const [branch, setBranch] = useState(null);
  const [allBranches, setAllBranches] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [branchTags, setBranchTags] = useState([]);
  const [sessionTags, setSessionTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [addTagId, setAddTagId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBranchTrash, setShowBranchTrash] = useState(false);
  const [branchTrashItems, setBranchTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const load = async () => {
    if (!branchId || !sessionId) return;
    const [branches, bTags, sTags] = await Promise.all([
      listSessionBranches(sessionId),
      getBranchTags(branchId),
      getSessionTags(sessionId),
    ]);
    const current = branches.find((b) => b.id === branchId) || null;
    setBranch(current);
    setAllBranches(branches);
    setNameInput(current?.name || "");
    setBranchTags(bTags);
    setSessionTags(sTags);
  };

  useEffect(() => {
    load();
  }, [sessionId, branchId]);

  const refreshAll = async () => {
    await load();
    onChanged?.();
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput === branch?.name) return;
    setBusy(true);
    try {
      await updateBranchName(branchId, nameInput.trim());
      await refreshAll();
    } catch (err) {
      alert("이름 수정 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleAutoName = async () => {
    setBusy(true);
    try {
      const res = await autoNameBranch(branchId);
      setNameInput(res.name);
      await refreshAll();
    } catch (err) {
      alert("자동 이름 생성 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleAutoTag = async () => {
    setBusy(true);
    try {
      await autoTagBranch(branchId);
      await refreshAll();
    } catch (err) {
      alert("자동 태그 생성 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (status === "deleted" && !window.confirm("이 브랜치를 휴지통으로 이동할까요?\n하위 브랜치도 함께 이동되며 7일 후 완전히 삭제됩니다.")) {
      return;
    }
    setBusy(true);
    try {
      await patchBranch(branchId, { status });
      await refreshAll();
    } catch (err) {
      alert("상태 변경 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenBranchTrash = async () => {
    const next = !showBranchTrash;
    setShowBranchTrash(next);
    if (next) {
      setTrashLoading(true);
      try {
        const data = await listBranchTrash(sessionId);
        setBranchTrashItems(data);
      } catch (err) {
        alert("브랜치 휴지통 로딩 실패: " + (err.response?.data?.detail || err.message));
      } finally {
        setTrashLoading(false);
      }
    }
  };

  const handleRestoreBranch = async (bid) => {
    try {
      await restoreBranch(bid);
      const data = await listBranchTrash(sessionId);
      setBranchTrashItems(data);
      await refreshAll();
    } catch (err) {
      alert("복원 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const handlePurgeBranch = async (bid) => {
    if (!window.confirm("영구 삭제하면 복원이 불가능합니다. 삭제할까요?")) return;
    try {
      await purgeBranch(bid);
      setBranchTrashItems((prev) => prev.filter((b) => b.id !== bid));
      await refreshAll();
    } catch (err) {
      alert("영구 삭제 실패: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCollapseToggle = async (is_collapsed) => {
    setBusy(true);
    try {
      await patchBranch(branchId, { is_collapsed });
      await refreshAll();
    } catch (err) {
      alert("접힘 상태 변경 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setBusy(true);
    try {
      const tag = await createTag(sessionId, newTagName.trim());
      await addBranchTag(branchId, tag.id);
      setNewTagName("");
      await refreshAll();
    } catch (err) {
      alert("태그 생성 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleAddExistingTag = async () => {
    if (!addTagId) return;
    setBusy(true);
    try {
      await addBranchTag(branchId, addTagId);
      setAddTagId("");
      await refreshAll();
    } catch (err) {
      alert("태그 추가 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveTag = async (tagId) => {
    setBusy(true);
    try {
      await removeBranchTag(branchId, tagId);
      await refreshAll();
    } catch (err) {
      alert("태그 제거 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setBusy(false);
    }
  };

  if (!branchId) return <div className="panel-empty">브랜치를 선택하세요</div>;
  if (!branch) return <div className="panel-empty">불러오는 중...</div>;

  const unassignedTags = sessionTags.filter(
    (t) => !branchTags.some((bt) => bt.id === t.id)
  );

  return (
    <div className="branch-manage-panel">
      <h4>브랜치 관리</h4>

      <div className="bmp-section">
        <label>이름</label>
        <div className="bmp-row">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            disabled={busy}
          />
          <button onClick={handleSaveName} disabled={busy}>저장</button>
          <button onClick={handleAutoName} disabled={busy}>자동 생성</button>
        </div>
      </div>

      {branch.is_merge && (
        <div className="bmp-section">
          <label>병합된 브랜치</label>
          <div className="tag-chip-list">
            {branch.merge_parent_ids.map((pid) => {
              const parent = allBranches.find((b) => b.id === pid);
              return (
                <span key={pid} className="tag-chip" style={{ background: "#ffedd5" }}>
                  🔀 {parent?.name || pid}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="bmp-section">
        <label>상태</label>
        <div className="bmp-row">
          <select
            value={branch.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={busy || (branch.parent_branch_id === null && !branch.is_merge)}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="deleted">deleted</option>
          </select>
          {branch.parent_branch_id === null && !branch.is_merge && (
            <span className="bmp-hint">root branch는 상태 변경 불가</span>
          )}
        </div>
      </div>

      <div className="bmp-section">
        <label>
          <input
            type="checkbox"
            checked={branch.is_collapsed}
            onChange={(e) => handleCollapseToggle(e.target.checked)}
            disabled={busy}
          />
          {" "}그래프에서 하위 브랜치 접기 (is_collapsed)
        </label>
      </div>

      <div className="bmp-section">
        <label>태그</label>
        <div className="tag-chip-list">
          {branchTags.length === 0 && <span className="bmp-hint">태그 없음</span>}
          {branchTags.map((t) => (
            <span key={t.id} className="tag-chip" style={{ background: t.color || "#e5e7eb" }}>
              {t.name}
              <button onClick={() => handleRemoveTag(t.id)} disabled={busy} title="태그 제거">×</button>
            </span>
          ))}
        </div>
        <div className="bmp-row">
          <button onClick={handleAutoTag} disabled={busy}>자동 태그 생성</button>
        </div>
        <div className="bmp-row">
          <select value={addTagId} onChange={(e) => setAddTagId(e.target.value)} disabled={busy}>
            <option value="">기존 태그 선택...</option>
            {unassignedTags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={handleAddExistingTag} disabled={busy || !addTagId}>추가</button>
        </div>
        <div className="bmp-row">
          <input
            placeholder="새 태그 이름"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            disabled={busy}
          />
          <button onClick={handleCreateTag} disabled={busy || !newTagName.trim()}>생성 + 부여</button>
        </div>
      </div>
      <div className="bmp-section trash-section" style={{ marginTop: 20 }}>
        <button className="trash-toggle-btn" onClick={handleOpenBranchTrash}>
          🗑 브랜치 휴지통 {showBranchTrash ? "▲" : "▼"}
        </button>
        {showBranchTrash && (
          <div className="trash-list">
            {trashLoading && <p className="bmp-hint">불러오는 중...</p>}
            {!trashLoading && branchTrashItems.length === 0 && (
              <p className="bmp-hint">휴지통이 비어있습니다</p>
            )}
            {branchTrashItems.map((b) => (
              <div key={b.id} className="trash-item">
                <span className="trash-item-title">{b.name}</span>
                <span className="trash-item-date">
                  {daysRemaining(b.deleted_at)}일 후 완전히 삭제
                </span>
                <div className="trash-item-actions">
                  <button onClick={() => handleRestoreBranch(b.id)}>복원</button>
                  <button className="danger" onClick={() => handlePurgeBranch(b.id)}>영구삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
