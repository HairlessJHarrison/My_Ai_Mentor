"""To-dos module — CRUD for one-off to-do items with completion toggling."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.todo import TodoItem, TodoItemCreate, TodoItemUpdate
from websocket import manager

router = APIRouter(prefix="/api/v1/todos", tags=["To-Dos"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("")
async def list_todos(
    completed: bool | None = Query(None, description="Filter by completion status"),
    member_id: int | None = Query(None, description="Filter by assigned member"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List to-do items with optional filters."""
    stmt = select(TodoItem).where(TodoItem.household_id == HOUSEHOLD_ID)

    if completed is not None:
        stmt = stmt.where(TodoItem.is_completed == completed)
    if member_id is not None:
        stmt = stmt.where(TodoItem.assigned_member_id == member_id)

    stmt = stmt.order_by(TodoItem.is_completed, TodoItem.created_at.desc())
    todos = session.exec(stmt).all()
    return [t.model_dump(mode="json") for t in todos]


@router.post("", status_code=201)
async def create_todo(
    body: TodoItemCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new to-do item."""
    todo = TodoItem.model_validate(body)
    session.add(todo)
    session.commit()
    session.refresh(todo)
    await manager.broadcast("todo_updated", todo.model_dump(mode="json"))
    return todo


@router.put("/{todo_id}")
async def update_todo(
    todo_id: int,
    body: TodoItemUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a to-do item."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="To-do not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(todo, key, value)

    session.add(todo)
    session.commit()
    session.refresh(todo)
    await manager.broadcast("todo_updated", todo.model_dump(mode="json"))
    return todo


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a to-do item permanently."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="To-do not found")

    session.delete(todo)
    session.commit()
    await manager.broadcast("todo_updated", {"deleted": True, "id": todo_id})
    return {"deleted": True}


@router.post("/{todo_id}/complete")
async def toggle_complete(
    todo_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Toggle completion status of a to-do item."""
    todo = session.get(TodoItem, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="To-do not found")

    todo.is_completed = not todo.is_completed
    todo.completed_at = dt.datetime.now(dt.timezone.utc) if todo.is_completed else None

    session.add(todo)
    session.commit()
    session.refresh(todo)
    await manager.broadcast("todo_updated", todo.model_dump(mode="json"))
    return todo
