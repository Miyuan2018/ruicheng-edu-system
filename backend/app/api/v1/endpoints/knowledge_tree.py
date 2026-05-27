"""V2.1.1 Versioned knowledge tree APIs."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.session import get_db
from app.models.syllabus import Syllabus
from app.models.knowledge_node import KnowledgeNode
from app.core.security import get_current_user
from typing import List, Optional

router = APIRouter()


def _node_to_tree(nodes: list, parent_id=None) -> list:
    """Convert flat node list to nested tree structure."""
    tree = []
    for n in sorted(nodes, key=lambda x: (x.sort_order or 0, x.name or "")):
        if str(n.parent_id or "") == str(parent_id or ""):
            children = _node_to_tree(nodes, str(n.id))
            tree.append({
                "key": str(n.id),
                "title": n.name,
                "node_type": n.node_type,
                "is_active": n.is_active,
                "invalid_reason": n.invalid_reason,
                "is_modified": n.is_modified,
                "sort_order": n.sort_order,
                "description": n.description,
                "children": children,
                "isLeaf": n.node_type == "POINT" and len(children) == 0,
            })
    return tree


@router.get("/syllabi/{syllabus_id}/tree")
async def get_knowledge_tree(
    syllabus_id: uuid.UUID,
    version: int = None,
    db: AsyncSession = Depends(get_db),
):
    """Get the knowledge tree for a syllabus version."""
    s_result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    syllabus = s_result.scalar_one_or_none()
    if not syllabus:
        raise HTTPException(404, detail="考纲不存在")

    v = version or syllabus.version or 1
    result = await db.execute(
        select(KnowledgeNode)
        .where(KnowledgeNode.syllabus_id == syllabus_id, KnowledgeNode.version == v)
        .order_by(KnowledgeNode.sort_order)
    )
    nodes = result.scalars().all()

    tree = _node_to_tree(nodes)
    return {
        "syllabus_id": str(syllabus_id),
        "title": syllabus.title,
        "current_version": syllabus.version,
        "requested_version": v,
        "tree": tree,
    }


@router.post("/syllabi/{syllabus_id}/nodes")
async def create_node(
    syllabus_id: uuid.UUID,
    name: str, node_type: str = "POINT",
    parent_id: str = None, sort_order: int = 0,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    s_result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    syllabus = s_result.scalar_one_or_none()
    if not syllabus:
        raise HTTPException(404, detail="考纲不存在")

    node = KnowledgeNode(
        syllabus_id=syllabus_id,
        parent_id=uuid.UUID(parent_id) if parent_id else None,
        name=name, node_type=node_type,
        sort_order=sort_order, version=syllabus.version,
        is_modified=True,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return {"id": str(node.id), "name": node.name, "node_type": node.node_type,
            "version": node.version, "is_modified": True}


@router.put("/syllabi/{syllabus_id}/nodes/{node_id}")
async def update_node(
    syllabus_id: uuid.UUID, node_id: uuid.UUID,
    name: str = None, description: str = None,
    sort_order: int = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(404, detail="节点不存在")

    if name:
        node.name = name
    if description is not None:
        node.description = description
    if sort_order is not None:
        node.sort_order = sort_order

    node.is_modified = True
    node.updated_at = datetime.now(timezone.utc)

    # Invalidate all descendants
    affected = await _invalidate_descendants(node.id, db)

    await db.commit()
    await db.refresh(node)
    return {"id": str(node.id), "modified": True, "affected_descendants": affected}


async def _invalidate_descendants(parent_id, db) -> int:
    """Set all descendants to inactive with PARENT_MODIFIED reason."""
    count = 0
    result = await db.execute(
        select(KnowledgeNode).where(KnowledgeNode.parent_id == parent_id, KnowledgeNode.is_active == True)
    )
    children = result.scalars().all()
    for child in children:
        child.is_active = False
        child.invalid_reason = "PARENT_MODIFIED"
        child.updated_at = datetime.now(timezone.utc)
        count += 1
        count += await _invalidate_descendants(child.id, db)
    return count


@router.post("/syllabi/{syllabus_id}/nodes/{node_id}/set-branch-active")
async def set_branch_active(
    syllabus_id: uuid.UUID, node_id: uuid.UUID,
    active: bool = True,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    count = await _set_subtree_active(node_id, active, db)
    await db.commit()
    return {"node_id": str(node_id), "active": active, "affected_nodes": count}


async def _set_subtree_active(node_id, active, db) -> int:
    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        return 0
    node.is_active = active
    node.invalid_reason = None if active else "MANUAL"
    node.updated_at = datetime.now(timezone.utc)
    count = 1

    child_result = await db.execute(
        select(KnowledgeNode).where(KnowledgeNode.parent_id == node_id)
    )
    for child in child_result.scalars().all():
        count += await _set_subtree_active(child.id, active, db)
    return count


@router.delete("/syllabi/{syllabus_id}/nodes/{node_id}")
async def delete_node(
    syllabus_id: uuid.UUID, node_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    count = await _set_subtree_active(node_id, False, db)
    # Override reason for deleted nodes
    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
    node = result.scalar_one_or_none()
    if node:
        node.invalid_reason = "MANUAL"
    await db.commit()
    return {"message": f"已删除节点及其 {count - 1} 个子节点"}


@router.post("/syllabi/{syllabus_id}/new-version")
async def create_new_version(
    syllabus_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    s_result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    old = s_result.scalar_one_or_none()
    if not old:
        raise HTTPException(404, detail="考纲不存在")

    new_version = Syllabus(
        title=old.title, grade_level=old.grade_level,
        province=old.province, subject=old.subject,
        content=old.content, knowledge_tree=old.knowledge_tree,
        version=(old.version or 1) + 1, is_current=True,
        parent_syllabus_id=old.id,
        created_by=uuid.UUID(current_user.id),
    )
    old.is_current = False
    db.add(new_version)
    await db.flush()

    # Copy active nodes to new version
    result = await db.execute(
        select(KnowledgeNode).where(
            KnowledgeNode.syllabus_id == syllabus_id,
            KnowledgeNode.version == old.version,
            KnowledgeNode.is_active == True,
        )
    )
    for old_node in result.scalars().all():
        new_node = KnowledgeNode(
            syllabus_id=new_version.id,
            parent_id=old_node.parent_id,
            name=old_node.name,
            node_type=old_node.node_type,
            sort_order=old_node.sort_order,
            version=new_version.version,
            is_active=True,
            is_modified=False,
            description=old_node.description,
            meta_data=old_node.meta_data,
        )
        db.add(new_node)

    await db.commit()
    await db.refresh(new_version)
    return {"id": str(new_version.id), "version": new_version.version, "message": "新版本创建成功"}


@router.put("/syllabi/{syllabus_id}/rollback")
async def rollback_version(
    syllabus_id: uuid.UUID,
    target_version: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rollback syllabus to a specific historical version."""
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    s_result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    current = s_result.scalar_one_or_none()
    if not current:
        raise HTTPException(404, detail="考纲不存在")

    # Find all versions in the chain
    all_ids = set()
    root = current
    while root.parent_syllabus_id:
        all_ids.add(str(root.parent_syllabus_id))
        pr = await db.execute(select(Syllabus).where(Syllabus.id == root.parent_syllabus_id))
        prev = pr.scalar_one_or_none()
        if not prev:
            break
        root = prev
    all_ids.add(str(root.id))
    # Forward chain
    nxt_id = str(root.id)
    while True:
        nr = await db.execute(select(Syllabus).where(Syllabus.parent_syllabus_id == nxt_id))
        nxt = nr.scalar_one_or_none()
        if not nxt:
            break
        all_ids.add(str(nxt.id))
        nxt_id = str(nxt.id)

    # Find target version
    target_result = await db.execute(
        select(Syllabus).where(
            Syllabus.id.in_(list(all_ids)),
            Syllabus.version == target_version,
        )
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, detail=f"目标版本 {target_version} 不存在")

    # Set all versions in chain to not current
    await db.execute(
        update(Syllabus)
        .where(Syllabus.id.in_(list(all_ids)))
        .values(is_current=False)
    )

    # Set target to current
    target.is_current = True
    target.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(target)

    return {
        "message": f"已回滚到版本 {target_version}",
        "syllabus_id": str(target.id),
        "version": target.version,
        "is_current": target.is_current,
    }


@router.get("/syllabi/{syllabus_id}/versions")
async def list_versions(
    syllabus_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    # Get current syllabus and all its version siblings
    s_result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    s = s_result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, detail="考纲不存在")

    # Find root (oldest version)
    root_id = syllabus_id
    current = s
    while current.parent_syllabus_id:
        pr = await db.execute(select(Syllabus).where(Syllabus.id == current.parent_syllabus_id))
        prev = pr.scalar_one_or_none()
        if not prev:
            break
        root_id = prev.id
        current = prev

    # Get all versions of this root
    versions = [{"id": str(root_id), "version": current.version, "is_current": current.is_current}]
    # Get newer versions
    next_id = root_id
    while True:
        nr = await db.execute(select(Syllabus).where(Syllabus.parent_syllabus_id == next_id))
        nxt = nr.scalar_one_or_none()
        if not nxt:
            break
        versions.append({"id": str(nxt.id), "version": nxt.version, "is_current": nxt.is_current})
        next_id = nxt.id

    return versions
