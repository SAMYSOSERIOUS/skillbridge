"""Move ranking shared by the API endpoints and the web-data builders."""

from skillbridge.config import load_config


def score(t: dict, origin_wage: float) -> float:
    """Balanced ranking score - same shape as the path score (config docs)."""
    cfg = load_config()["paths"]
    return (
        t["wage_delta"] / max(origin_wage, 1.0)
        - cfg["lambda_gap"] * t["skill_gap"]
        - cfg["mu_exposure"] * max(t["exposure_delta"], 0.0)
    )


def pick_best_moves(trans: list[dict], origin_wage: float) -> tuple[dict | None, dict | None]:
    """The two panel picks: biggest win (best score) and closest win
    (least retraining) among frontier moves with a pay gain."""
    positive_pareto = [t for t in trans if t["pareto"] and t["wage_delta"] > 0]
    best = max(positive_pareto, key=lambda t: score(t, origin_wage), default=None)
    closest = min(positive_pareto, key=lambda t: t["skill_gap"], default=None)
    if closest is best:
        closest = None
    return best, closest
