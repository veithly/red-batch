"""Red Batch — Batch Containment Agent (UiPath Coded Agent).

A deterministic product-safety containment agent, published to UiPath Automation
Cloud as a coded agent. Given a safety signal on a manufacturing lot, it traces
the lot to its SKU and warehouse, scopes the Ready-to-Ship orders that must be
held, estimates the value at risk, and decides whether the hold can proceed
behind a human approval or must be routed to human review (low confidence).

This is the same containment policy the Red Batch web app runs
(`app/lib/policy.ts`), expressed as a UiPath coded-agent entry point so it can be
packaged and published to the tenant. The state-changing hold is always gated
behind a human approval — a UiPath Action Center task in the full product — so
this agent never mutates order state on its own; it produces the governed plan.
"""

from dataclasses import dataclass

# Containment policy thresholds (mirror of app/lib/policy.ts).
ACTION_CONFIDENCE_FLOOR = 0.70
AVG_ORDER_VALUE = 9743.0  # ~$360,480 held / 37 orders in the reference case RB-2049


@dataclass
class ContainmentIn:
    """A product-safety signal arriving on a manufacturing lot."""

    case_code: str
    lot_id: str
    sku: str
    warehouse: str
    confidence: float
    ready_to_ship_orders: int = 48
    out_of_scope_orders: int = 11
    severity: str = "high"


@dataclass
class ContainmentOut:
    """The governed containment plan (no state is changed without human approval)."""

    case_code: str
    decision: str  # "stop_ship_full" | "human_review_required"
    orders_to_hold: int
    orders_excluded: int
    est_value_held: float
    zones: int
    requires_approval: bool
    rationale: str


def main(input: ContainmentIn) -> ContainmentOut:
    in_scope = max(input.ready_to_ship_orders - input.out_of_scope_orders, 0)
    zones = 3 if in_scope >= 20 else (2 if in_scope >= 8 else 1)

    if input.confidence >= ACTION_CONFIDENCE_FLOOR:
        orders_to_hold = in_scope
        decision = "stop_ship_full"
        rationale = (
            f"Confidence {input.confidence:.2f} >= floor {ACTION_CONFIDENCE_FLOOR:.2f}: "
            f"scope a full stop-ship of all {orders_to_hold} in-scope Ready-to-Ship orders "
            f"for {input.sku} in {input.warehouse} (lot {input.lot_id}); "
            f"{input.out_of_scope_orders} orders excluded as out of scope. "
            f"The hold itself requires a human QA approval (UiPath Action Center task) "
            f"before any order state changes."
        )
    else:
        orders_to_hold = min(5, in_scope)
        decision = "human_review_required"
        rationale = (
            f"Confidence {input.confidence:.2f} < floor {ACTION_CONFIDENCE_FLOOR:.2f}: "
            f"the agent will not act alone. Route to Human Review and propose a partial "
            f"{orders_to_hold}-order hold pending evidence."
        )

    return ContainmentOut(
        case_code=input.case_code,
        decision=decision,
        orders_to_hold=orders_to_hold,
        orders_excluded=input.out_of_scope_orders,
        est_value_held=round(orders_to_hold * AVG_ORDER_VALUE, 2),
        zones=zones,
        requires_approval=True,
        rationale=rationale,
    )
