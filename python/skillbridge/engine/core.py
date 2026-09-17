"""Pure engine functions (no I/O) - docs/03_ARCHITECTURE.md §4.

All matrices are numpy arrays over a shared occupation index:
- ``importance`` and ``level``: shape (n_occupations, n_skills), values 0..1.
- The occupation vector is elementwise importance x level.

Everything here is deterministic and unit-tested on synthetic fixtures.
"""

import numpy as np


def occupation_vectors(importance: np.ndarray, level: np.ndarray) -> np.ndarray:
    """Vector = importance-weighted level (docs §4.1)."""
    return importance * level


def skill_gap_matrix(
    importance: np.ndarray,
    level: np.ndarray,
    alpha: float,
    beta: float,
    gamma: float = 0.0,
    job_zone: np.ndarray | None = None,
) -> np.ndarray:
    """Asymmetric skill gap for every (origin, target) pair.

    gap[o, t] = alpha * cosine_distance(vec_o, vec_t)
              + beta  * sum_k max(0, LV_t[k] - LV_o[k]) * IM_t[k] / sum_k IM_t[k]
              + gamma * max(0, JZ_t - JZ_o) / 4

    Only *deficits* count in the second and third terms, which is what makes
    gap(a, b) != gap(b, a): moving up-skill costs more than moving down.
    The job-zone term encodes education/preparation distance (O*NET Job
    Zones 1-5), which the 11 basic skills alone cannot see - without it,
    occupations with similar cognitive profiles but very different
    credentials look deceptively close. Result is in [0, 1].
    """
    vec = occupation_vectors(importance, level)
    norms = np.linalg.norm(vec, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    unit = vec / norms
    cosine_dist = np.clip(1.0 - unit @ unit.T, 0.0, 1.0)

    n = level.shape[0]
    deficit = np.zeros((n, n))
    im_sums = importance.sum(axis=1)
    im_sums[im_sums == 0] = 1.0
    for t in range(n):
        shortfall = np.clip(level[t][None, :] - level, 0.0, None)  # (n_origins, k)
        deficit[:, t] = (shortfall * importance[t][None, :]).sum(axis=1) / im_sums[t]

    gap = alpha * cosine_dist + beta * deficit
    if gamma > 0 and job_zone is not None:
        jz_up = np.clip(job_zone[None, :] - job_zone[:, None], 0.0, None) / 4.0
        gap = gap + gamma * jz_up
    return gap


def feasibility_threshold(gaps_from_origin: np.ndarray, tau_percentile: float) -> float:
    """tau = the given percentile of an origin's gaps (docs §4.3)."""
    finite = gaps_from_origin[np.isfinite(gaps_from_origin)]
    return float(np.percentile(finite, tau_percentile)) if finite.size else np.inf


def pareto_front(
    skill_gap: np.ndarray,
    wage_delta: np.ndarray,
    exposure_delta: np.ndarray,
) -> np.ndarray:
    """Non-dominated mask over (gap min, wage_delta max, exposure_delta min).

    A candidate is dominated when another candidate is at least as good on
    all three objectives and strictly better on at least one.
    """
    n = skill_gap.shape[0]
    if n == 0:
        return np.zeros(0, dtype=bool)
    g = skill_gap[:, None]
    w = wage_delta[:, None]
    e = exposure_delta[:, None]
    at_least_as_good = (g.T <= g) & (w.T >= w) & (e.T <= e)
    strictly_better = (g.T < g) | (w.T > w) | (e.T < e)
    dominated = (at_least_as_good & strictly_better).any(axis=1)
    return ~dominated


def beam_search_paths(
    edges: dict[int, list[tuple[int, float, float]]],
    origin: int,
    wages: np.ndarray,
    exposure: np.ndarray,
    *,
    beam_width: int,
    max_hops: int,
    lambda_gap: float,
    mu_exposure: float,
    top_k: int,
) -> list[dict]:
    """Multi-hop escape routes (docs §4.4).

    ``edges[o]`` lists (target, skill_gap, wage_delta) for feasible hops.
    Score (dimensionless) = cum_wage_delta / origin_wage
                          - lambda * cum_gap - mu * final_exposure.
    Returns up to top_k paths of 1..max_hops hops, best score first;
    at most one path per final destination (distinct outcomes).
    """
    origin_wage = wages[origin]
    if not np.isfinite(origin_wage) or origin_wage <= 0:
        return []

    # state: (nodes tuple, cum_gap, cum_wage_delta)
    beam: list[tuple[tuple[int, ...], float, float]] = [((origin,), 0.0, 0.0)]
    complete: list[tuple[tuple[int, ...], float, float, float]] = []

    for _ in range(max_hops):
        candidates: list[tuple[tuple[int, ...], float, float]] = []
        for nodes, cum_gap, cum_wage in beam:
            for target, gap, wage_delta in edges.get(nodes[-1], []):
                if target in nodes:
                    continue
                candidates.append((nodes + (target,), cum_gap + gap, cum_wage + wage_delta))
        if not candidates:
            break

        def score(state: tuple[tuple[int, ...], float, float]) -> float:
            nodes, cum_gap, cum_wage = state
            return (
                cum_wage / origin_wage
                - lambda_gap * cum_gap
                - mu_exposure * float(exposure[nodes[-1]])
            )

        candidates.sort(key=score, reverse=True)
        beam = candidates[:beam_width]
        complete.extend((nodes, g, w, score((nodes, g, w))) for nodes, g, w in beam)

    complete.sort(key=lambda s: s[3], reverse=True)
    out: list[dict] = []
    seen_final: set[int] = set()
    for nodes, cum_gap, cum_wage, sc in complete:
        final = nodes[-1]
        if final in seen_final:
            continue
        seen_final.add(final)
        out.append(
            {
                "nodes": list(nodes),
                "cumulative_skill_gap": float(cum_gap),
                "cumulative_wage_delta": float(cum_wage),
                "final_exposure": float(exposure[final]),
                "score": float(sc),
            }
        )
        if len(out) == top_k:
            break
    return out


def bom_tiers(
    origin_level: np.ndarray,
    target_level: np.ndarray,
    target_importance: np.ndarray,
    skills: list[str],
    *,
    relevant_importance_min: float,
    transferable_tolerance: float,
    upgrade_floor_ratio: float,
) -> dict[str, list[dict]]:
    """Skill-Gap Bill of Materials: three tiers, ranked by weighted gap."""
    tiers: dict[str, list[dict]] = {"transferable": [], "upgrade": [], "acquire": []}
    for k, skill in enumerate(skills):
        t_im = float(target_importance[k])
        if t_im < relevant_importance_min:
            continue
        o_lv = float(origin_level[k])
        t_lv = float(target_level[k])
        gap = max(0.0, t_lv - o_lv)
        entry = {
            "skill": skill,
            "origin_level": round(o_lv * 100, 1),
            "target_level": round(t_lv * 100, 1),
            "target_importance": round(t_im * 100, 1),
            "gap": round(gap * 100, 1),
            "weighted_gap": gap * t_im,
        }
        if o_lv >= t_lv - transferable_tolerance:
            tiers["transferable"].append(entry)
        elif o_lv >= upgrade_floor_ratio * t_lv:
            tiers["upgrade"].append(entry)
        else:
            tiers["acquire"].append(entry)
    for tier in tiers.values():
        tier.sort(key=lambda e: e["weighted_gap"], reverse=True)
    return tiers
