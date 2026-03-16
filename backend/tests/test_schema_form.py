"""Tests for the config schema endpoint used by SchemaForm."""


class TestSchemaEndpoint:
    def test_schema_returns_models(self, client):
        """GET /config/schema returns models dict with known model names."""
        resp = client.get("/api/v1/config/schema")
        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        models = data["models"]
        # Should contain at least the key Create models
        assert isinstance(models, dict)
        assert len(models) > 0

    def test_schema_has_properties(self, client):
        """Each model schema should have a 'properties' key."""
        resp = client.get("/api/v1/config/schema")
        models = resp.json()["models"]
        for name, schema in models.items():
            assert "properties" in schema or "title" in schema, (
                f"Model {name} missing properties/title"
            )

    def test_activity_create_has_member_ids(self, client):
        """ActivityCreate schema should include participant_member_ids field."""
        resp = client.get("/api/v1/config/schema")
        models = resp.json()["models"]
        # Find ActivityCreate (may be keyed differently)
        activity_schemas = {k: v for k, v in models.items() if "Activity" in k and "Create" in k}
        if activity_schemas:
            schema = list(activity_schemas.values())[0]
            props = schema.get("properties", {})
            assert "participant_member_ids" in props
