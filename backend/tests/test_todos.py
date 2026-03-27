"""Tests for to-dos API endpoints."""

import datetime as dt

from tests.conftest import make_member, make_todo


class TestListTodos:
    def test_empty(self, client):
        resp = client.get("/api/v1/todos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_todos(self, client, session):
        make_todo(session, title="Buy milk")
        make_todo(session, title="Call dentist")
        resp = client.get("/api/v1/todos")
        assert len(resp.json()) == 2

    def test_filter_completed(self, client, session):
        make_todo(session, title="Done task", is_completed=True)
        make_todo(session, title="Open task", is_completed=False)
        resp = client.get("/api/v1/todos?completed=false")
        todos = resp.json()
        assert len(todos) == 1
        assert todos[0]["title"] == "Open task"

    def test_filter_by_member(self, client, session):
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")
        make_todo(session, title="Alice task", assigned_member_id=m1.id)
        make_todo(session, title="Bob task", assigned_member_id=m2.id)
        resp = client.get(f"/api/v1/todos?member_id={m1.id}")
        todos = resp.json()
        assert len(todos) == 1
        assert todos[0]["title"] == "Alice task"


class TestCreateTodo:
    def test_create(self, client):
        resp = client.post("/api/v1/todos", json={
            "household_id": "default",
            "title": "Buy groceries",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Buy groceries"
        assert data["priority"] == "medium"
        assert data["is_completed"] is False

    def test_create_with_priority_and_due_date(self, client, session):
        m = make_member(session)
        resp = client.post("/api/v1/todos", json={
            "household_id": "default",
            "title": "Urgent task",
            "priority": "high",
            "due_date": "2026-04-01",
            "assigned_member_id": m.id,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["priority"] == "high"
        assert data["due_date"] == "2026-04-01"
        assert data["assigned_member_id"] == m.id

    def test_invalid_priority(self, client):
        resp = client.post("/api/v1/todos", json={
            "household_id": "default",
            "title": "Bad priority",
            "priority": "critical",
        })
        assert resp.status_code == 422


class TestUpdateTodo:
    def test_update(self, client, session):
        t = make_todo(session, title="Old title")
        resp = client.put(f"/api/v1/todos/{t.id}", json={"title": "New title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New title"

    def test_not_found(self, client):
        resp = client.put("/api/v1/todos/999", json={"title": "X"})
        assert resp.status_code == 404


class TestDeleteTodo:
    def test_delete(self, client, session):
        t = make_todo(session)
        resp = client.delete(f"/api/v1/todos/{t.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        # Verify it's gone
        resp = client.get("/api/v1/todos")
        assert len(resp.json()) == 0

    def test_not_found(self, client):
        resp = client.delete("/api/v1/todos/999")
        assert resp.status_code == 404


class TestToggleComplete:
    def test_toggle_on(self, client, session):
        t = make_todo(session, is_completed=False)
        resp = client.post(f"/api/v1/todos/{t.id}/complete")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_completed"] is True
        assert data["completed_at"] is not None

    def test_toggle_off(self, client, session):
        t = make_todo(session, is_completed=True)
        resp = client.post(f"/api/v1/todos/{t.id}/complete")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_completed"] is False
        assert data["completed_at"] is None

    def test_not_found(self, client):
        resp = client.post("/api/v1/todos/999/complete")
        assert resp.status_code == 404
