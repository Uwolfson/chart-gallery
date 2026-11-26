"""Build the data for ChartKit.flowSankey from a row-level table with three categorical columns,
and order the nodes so that the flows cross less (barycenter heuristic).

Usage
-----
    import pandas as pd
    from flow_order import flow

    d = flow(df, left="visit_type", middle="what_they_did", right="style", pin_last=["Saved nothing"])
    d["columns"]   # [[left names], [middle names], [right names]] in drawing order
    d["links"]     # [{"source", "target", "value"}]
    # pass both to ChartKit.flowSankey together with a {node: colour} map; set reorder: false (already ordered)

The same ordering is implemented in JavaScript as ChartKit.orderFlow, so this helper is only needed
when you want the order fixed at data-preparation time.
"""
from __future__ import annotations

import pandas as pd


def flow(df: pd.DataFrame, left: str, middle: str, right: str, pin_last: list[str] | None = None, rounds: int = 6) -> dict:
    t = df[[left, middle, right]].dropna()
    lc, cr = pd.crosstab(t[left], t[middle]), pd.crosstab(t[middle], t[right])
    L, C, R = list(lc.index), list(lc.columns), list(cr.columns)
    pin = [n for n in (pin_last or []) if n in R]

    def bary(m: pd.DataFrame, order: list[str]) -> dict:
        pos = pd.Series(range(len(order)), index=order).reindex(m.columns)
        return {n: float((m.loc[n] * pos).sum() / max(m.loc[n].sum(), 1)) for n in m.index}

    for _ in range(rounds):
        bl = bary(lc, C); L = sorted(L, key=lambda n: bl[n])
        br = bary(cr.T, C); R = sorted([n for n in R if n not in pin], key=lambda n: br[n]) + pin
        b1, b2 = bary(lc.T, L), bary(cr, R)
        C = sorted(C, key=lambda n: b1[n] / max(1, len(L) - 1) + b2[n] / max(1, len(R) - 1))

    links = [dict(source=a, target=b, value=int(v)) for (a, b), v in t.groupby([left, middle]).size().items()]
    links += [dict(source=a, target=b, value=int(v)) for (a, b), v in t.groupby([middle, right]).size().items()]
    return dict(columns=[L, C, R], links=links, total=int(len(t)))
