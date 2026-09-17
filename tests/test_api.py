"""API contract tests (load-bearing: the browser depends on these shapes).

They run against the bundled synthetic fixture, so CI needs no downloads.
When M2 swaps the fixture for real precomputed artifacts, these tests must
keep passing unchanged - that is the contract.
"""

from fastapi.testclient import TestClient
from skillbridge.api.main import app

client = TestClient(app)

TELLER = "43-3071"
LOAN_OFFICER = "13-2072"


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_occupation_search_shape():
    r = client.get("/api/occupations", params={"q": "teller"})
    assert r.status_code == 200
    body = r.json()
    assert body["results"], "search for 'teller' must return at least one hit"
    hit = body["results"][0]
    assert set(hit) == {"soc_code", "title", "display_title"}


def test_occupation_search_caps_at_8():
    r = client.get("/api/occupations", params={"q": ""})
    assert len(r.json()["results"]) <= 8


def test_transitions_shape_and_frontier():
    r = client.get(f"/api/transitions/{TELLER}")
    assert r.status_code == 200
    body = r.json()
    assert body["origin"]["display_title"] == "Bank Teller"
    keys = {"to_soc", "to_title", "skill_gap", "wage_delta", "exposure_delta", "pareto", "feasible"}
    for t in body["transitions"]:
        assert keys <= set(t)
    assert any(t["pareto"] for t in body["transitions"]), "frontier must be non-empty"
    assert body["synthetic"] is True, "sample mode must self-identify as synthetic"


def test_transitions_unknown_occupation_is_friendly():
    r = client.get("/api/transitions/99-9999")
    assert r.status_code == 404
    assert "job title" in r.json()["detail"]


def test_bom_three_tiers():
    r = client.get(f"/api/bom/{TELLER}/{LOAN_OFFICER}")
    assert r.status_code == 200
    body = r.json()
    assert {"transferable", "upgrade", "acquire", "wage_delta"} <= set(body)
    for item in body["upgrade"] + body["acquire"]:
        assert item["gap"] > 0


def test_paths_shape():
    r = client.get(f"/api/paths/{TELLER}")
    assert r.status_code == 200
    path = r.json()["paths"][0]
    assert len(path["hops"]) >= 2
    assert {"cumulative_wage_delta", "cumulative_skill_gap", "final_exposure"} <= set(path)


def test_exposure_always_has_all_three_sources():
    """Hard rule 6: the composite never appears without the per-source values."""
    r = client.get(f"/api/exposure/{TELLER}")
    assert r.status_code == 200
    exp = r.json()["exposure"]
    assert {"aioe", "openai", "msft", "composite", "agreement"} <= set(exp)


def test_root_serves_frontend():
    r = client.get("/")
    assert r.status_code == 200
    assert "SkillBridge" in r.text


def test_static_assets_served():
    for path in ("/styles.css", "/app.js"):
        r = client.get(path)
        assert r.status_code == 200, f"{path} must be served by the app"
