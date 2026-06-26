def build_branch_graph(branches: list, message_counts: dict, include_inactive: bool = False) -> dict:
    """branches 목록을 nodes / edges 형태로 변환한다.

    - nodes: 각 브랜치 하나
    - edges: parent_branch_id 가 있는 브랜치마다 parent → child 관계 하나
    - include_inactive=False 이면 deleted 브랜치는 제외한다.
    - is_collapsed=True 인 브랜치의 모든 하위 브랜치는 nodes/edges에서 제외한다.
    """
    visible = [b for b in branches if include_inactive or b.status != "deleted"]

    # parent_id → 자식 id 목록 맵
    children_map: dict[str, list[str]] = {}
    for b in visible:
        if b.parent_branch_id:
            children_map.setdefault(b.parent_branch_id, []).append(b.id)

    # 접힌 브랜치의 모든 하위 브랜치 id 수집 (BFS)
    hidden_ids: set[str] = set()
    for b in visible:
        if b.is_collapsed:
            queue = list(children_map.get(b.id, []))
            while queue:
                child_id = queue.pop()
                hidden_ids.add(child_id)
                queue.extend(children_map.get(child_id, []))

    nodes = []
    edges = []

    for branch in visible:
        if branch.id in hidden_ids:
            continue

        nodes.append({
            "id": branch.id,
            "type": "branch",
            "label": branch.name,
            "status": branch.status,
            "is_collapsed": branch.is_collapsed,
            "message_count": message_counts.get(branch.id, 0),
        })

        if branch.parent_branch_id is not None:
            edges.append({
                "id": f"edge-{branch.id}",
                "source": branch.parent_branch_id,
                "target": branch.id,
                "type": "fork",
                "fork_from_message_id": branch.fork_from_message_id,
            })

    return {"nodes": nodes, "edges": edges}
