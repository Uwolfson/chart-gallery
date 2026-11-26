"""Rule-based segments from the variables that drive a metric, ready for ChartKit.segmentTree.

Why a tree and not clustering: clustering groups rows by which features occur together, so the result often
hangs on one variable and barely separates the metric. A tree splits on whatever separates the metric most,
so each segment is a short combination of conditions with a clearly different value.

Usage
-----
    import pandas as pd
    from tree_segments import tree_segments

    X = df[["booked_before", "dates_chosen", "signed_in"]]                # 0/1 columns
    labels = {"booked_before": ("Booked here before", "Never booked here"),
              "dates_chosen": ("Dates already chosen", "Flexible dates"),
              "signed_in": ("Signed in", "Not signed in")}
    res = tree_segments(X, df["booked"], labels, root_name="All visits")
    res["tree"]      # nested dict for ChartKit.segmentTree (share and value in percent)
    res["leaves"]    # one row per final segment: name, n, share, value, 95% interval
    res["auc"]       # in-sample and out-of-fold AUC: do the rules hold on data they have not seen?

Requires pandas, numpy, scikit-learn.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import KFold
from sklearn.tree import DecisionTreeClassifier


def tree_segments(X: pd.DataFrame, y: pd.Series, labels: dict[str, tuple[str, str]], *, root_name: str = "All",
                  max_leaves: int = 8, min_leaf: int | float = 0.04, peel: str | None = None, seed: int = 0) -> dict:
    """Fit a small decision tree on 0/1 features and return it as nested segments.

    labels   {column: (label when 1, label when 0)} — the text written on each branch.
    min_leaf minimum segment size: rows if int, share of the base if float.
    peel     optional column to split off first as its own segment (a rare but strong factor the tree would not isolate).
    """
    X = X.astype(int); y = y.astype(int).reindex(X.index)
    n_all = len(y)
    min_n = int(min_leaf * n_all) if isinstance(min_leaf, float) else int(min_leaf)
    peeled = (X[peel] == 1) if peel else pd.Series(False, index=X.index)
    Xt, yt = X.loc[~peeled].drop(columns=[peel] if peel else []), y[~peeled]

    make = lambda: DecisionTreeClassifier(max_leaf_nodes=max_leaves, min_samples_leaf=min_n, criterion="entropy", random_state=seed)
    model = make().fit(Xt, yt)
    names, T = list(Xt.columns), model.tree_

    # honest check: rules found on 4/5 of the rows are scored on the remaining 1/5
    oof = pd.Series(np.nan, index=Xt.index)
    for tr, te in KFold(5, shuffle=True, random_state=seed).split(Xt):
        oof.iloc[te] = make().fit(Xt.iloc[tr], yt.iloc[tr]).predict_proba(Xt.iloc[te])[:, 1]
    fill = y[peeled].mean() if peeled.any() else np.nan
    p_in = pd.Series(model.predict_proba(Xt)[:, 1], index=Xt.index).reindex(X.index).fillna(fill)
    p_oof = oof.reindex(X.index).fillna(fill)

    def stats(mask: pd.Series, name: str) -> dict:
        n = int(mask.sum()); p = float(y[mask].mean()); se = (p * (1 - p) / n) ** 0.5
        return dict(name=name, n=n, share=100 * n / n_all, value=100 * p, lo=100 * (p - 1.96 * se), hi=100 * (p + 1.96 * se))

    leaves: list[dict] = []

    def nest(node: int, mask: pd.Series, name: str, path: list[str]) -> dict:
        full = mask.reindex(X.index).fillna(False)
        nd = stats(full, name)
        if T.children_left[node] == -1:
            leaves.append({**nd, "name": " · ".join(path) if path else name})
            return {k: nd[k] for k in ("name", "n", "share", "value")}
        f = names[T.feature[node]]; has = Xt[f] == 1
        kids = [nest(T.children_right[node], mask & has, labels[f][0], path + [labels[f][0]]),
                nest(T.children_left[node], mask & ~has, labels[f][1], path + [labels[f][1]])]
        return {**{k: nd[k] for k in ("name", "n", "share", "value")}, "children": sorted(kids, key=lambda k: -k["value"])}

    sub = nest(0, pd.Series(True, index=Xt.index), root_name, [])
    children = sub.get("children", [])
    if peel:
        st = stats(peeled, labels[peel][0]); leaves.append(st)
        children = [{k: st[k] for k in ("name", "n", "share", "value")}] + children
    tree = dict(name=root_name, n=n_all, share=100.0, value=float(100 * y.mean()), children=children)
    return dict(tree=tree, leaves=sorted(leaves, key=lambda r: -r["value"]), base=float(100 * y.mean()),
                auc=dict(in_sample=float(roc_auc_score(y, p_in)), out_of_fold=float(roc_auc_score(y, p_oof))),
                importance=dict(sorted(zip(names, map(float, model.feature_importances_)), key=lambda kv: -kv[1])))


if __name__ == "__main__":      # tiny synthetic demo
    rng = np.random.default_rng(3); n = 5000
    X = pd.DataFrame({"booked_before": rng.random(n) < .24, "dates_chosen": rng.random(n) < .48, "signed_in": rng.random(n) < .38, "price_alert": rng.random(n) < .05}).astype(int)
    p = 0.11 + 0.17 * X.booked_before + 0.12 * X.dates_chosen + 0.09 * X.signed_in + 0.3 * X.price_alert
    y = pd.Series((rng.random(n) < p).astype(int))
    lab = {"booked_before": ("Booked here before", "Never booked here"), "dates_chosen": ("Dates already chosen", "Flexible dates"),
           "signed_in": ("Signed in", "Not signed in"), "price_alert": ("Came from a price alert", "No price alert")}
    out = tree_segments(X, y, lab, root_name="All visits", peel="price_alert")
    for r in out["leaves"]:
        print(f"{r['share']:5.1f}%  value {r['value']:4.1f}% [{r['lo']:.0f}–{r['hi']:.0f}]  n={r['n']:4d}  {r['name']}")
    print("AUC", out["auc"])
