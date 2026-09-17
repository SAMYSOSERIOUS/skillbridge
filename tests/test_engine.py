"""Engine unit tests on synthetic fixtures (docs/03_ARCHITECTURE.md §6)."""

import numpy as np
from skillbridge.engine import core

# Three synthetic occupations x two skills, values 0..1
IMP = np.array([[1.0, 0.2], [0.8, 0.8], [0.2, 1.0]])
LVL = np.array([[0.9, 0.1], [0.6, 0.6], [0.1, 0.9]])


def test_gap_is_zero_on_diagonal():
    gaps = core.skill_gap_matrix(IMP, LVL, alpha=0.4, beta=0.6)
    assert np.allclose(np.diag(gaps), 0.0, atol=1e-9)


def test_gap_is_asymmetric():
    """Moving up-skill must cost more than moving down (docs §4.1)."""
    imp = np.array([[1.0, 1.0], [1.0, 1.0]])
    lvl = np.array([[0.2, 0.2], [0.9, 0.9]])  # 0 = novice, 1 = expert
    gaps = core.skill_gap_matrix(imp, lvl, alpha=0.4, beta=0.6)
    assert gaps[0, 1] > gaps[1, 0]


def test_gap_bounded_zero_one():
    gaps = core.skill_gap_matrix(IMP, LVL, alpha=0.4, beta=0.6)
    assert (gaps >= 0).all() and (gaps <= 1).all()


def test_pareto_front_simple():
    # c0: gap .1, wage +10k, exp -.1  -> on frontier
    # c1: gap .2, wage +5k,  exp -.05 -> dominated by c0
    # c2: gap .05, wage +2k, exp -.2  -> on frontier (cheapest, safest)
    gap = np.array([0.1, 0.2, 0.05])
    wage = np.array([10000.0, 5000.0, 2000.0])
    exp = np.array([-0.1, -0.05, -0.2])
    mask = core.pareto_front(gap, wage, exp)
    assert mask.tolist() == [True, False, True]


def test_pareto_identical_points_both_kept():
    gap = np.array([0.1, 0.1])
    wage = np.array([1000.0, 1000.0])
    exp = np.array([0.0, 0.0])
    assert core.pareto_front(gap, wage, exp).all()


def test_feasibility_threshold_percentile():
    gaps = np.array([0.1, 0.2, 0.3, 0.4, np.inf])
    tau = core.feasibility_threshold(gaps, 50)
    assert 0.2 <= tau <= 0.3


def test_beam_search_finds_two_hop_ladder():
    # 0 -> 1 -> 2 is the ladder; no direct 0 -> 2 edge.
    edges = {0: [(1, 0.2, 10000.0)], 1: [(2, 0.2, 10000.0)], 2: []}
    wages = np.array([30000.0, 40000.0, 50000.0])
    exposure = np.array([0.8, 0.5, 0.3])
    paths = core.beam_search_paths(
        edges,
        0,
        wages,
        exposure,
        beam_width=5,
        max_hops=3,
        lambda_gap=1.0,
        mu_exposure=1.0,
        top_k=5,
    )
    assert paths, "expected at least one path"
    best = paths[0]
    assert best["nodes"] == [0, 1, 2]
    assert best["cumulative_wage_delta"] == 20000.0


def test_beam_search_is_deterministic():
    edges = {0: [(1, 0.2, 5000.0), (2, 0.3, 8000.0)], 1: [(2, 0.1, 3000.0)], 2: []}
    wages = np.array([30000.0, 35000.0, 38000.0])
    exposure = np.array([0.7, 0.6, 0.4])
    kwargs = dict(beam_width=5, max_hops=3, lambda_gap=1.0, mu_exposure=1.0, top_k=5)
    a = core.beam_search_paths(edges, 0, wages, exposure, **kwargs)
    b = core.beam_search_paths(edges, 0, wages, exposure, **kwargs)
    assert a == b


def test_bom_tiers_split_and_rank():
    skills = ["A", "B", "C", "D"]
    origin_lvl = np.array([0.8, 0.4, 0.05, 0.9])
    target_lvl = np.array([0.7, 0.8, 0.8, 0.2])
    target_imp = np.array([0.9, 0.9, 0.6, 0.1])  # D irrelevant (< 0.30)
    tiers = core.bom_tiers(
        origin_lvl,
        target_lvl,
        target_imp,
        skills,
        relevant_importance_min=0.30,
        transferable_tolerance=0.05,
        upgrade_floor_ratio=0.40,
    )
    assert [e["skill"] for e in tiers["transferable"]] == ["A"]
    assert [e["skill"] for e in tiers["upgrade"]] == ["B"]
    assert [e["skill"] for e in tiers["acquire"]] == ["C"]
    assert all(e["skill"] != "D" for t in tiers.values() for e in t)
