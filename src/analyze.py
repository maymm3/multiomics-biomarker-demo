#!/usr/bin/env python3
"""Validate, correct, analyse, and report a longitudinal protein table."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path


REQUIRED_COLUMNS = {"patient_id", "group", "batch", "timepoint", "protein", "npx"}


def read_rows(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing_columns = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing_columns:
            raise ValueError(f"Missing required columns: {sorted(missing_columns)}")
        rows = []
        for row in reader:
            value = None if row["npx"] == "" else float(row["npx"])
            rows.append({**row, "npx": value})
    if not rows:
        raise ValueError("Input contains no data rows")
    return rows


def batch_correct(rows: list[dict]) -> dict[tuple[str, str, str, str], float]:
    batch_values: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    overall_values: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in rows:
        if row["npx"] is None:
            continue
        batch_values[(row["protein"], row["timepoint"], row["batch"])].append(row["npx"])
        overall_values[(row["protein"], row["timepoint"])].append(row["npx"])
    batch_means = {key: statistics.fmean(values) for key, values in batch_values.items()}
    overall_means = {key: statistics.fmean(values) for key, values in overall_values.items()}
    corrected = {}
    for row in rows:
        if row["npx"] is None:
            continue
        corrected[(row["patient_id"], row["timepoint"], row["protein"], row["group"])] = (
            row["npx"]
            - batch_means[(row["protein"], row["timepoint"], row["batch"])]
            + overall_means[(row["protein"], row["timepoint"])]
        )
    return corrected


def welch_t(left: list[float], right: list[float]) -> float:
    if len(left) < 2 or len(right) < 2:
        return 0.0
    numerator = statistics.fmean(left) - statistics.fmean(right)
    denominator = math.sqrt(statistics.variance(left) / len(left) + statistics.variance(right) / len(right))
    return numerator / denominator if denominator else 0.0


def cohen_d(left: list[float], right: list[float]) -> float:
    if len(left) < 2 or len(right) < 2:
        return 0.0
    pooled_var = (
        (len(left) - 1) * statistics.variance(left)
        + (len(right) - 1) * statistics.variance(right)
    ) / (len(left) + len(right) - 2)
    return (statistics.fmean(left) - statistics.fmean(right)) / math.sqrt(pooled_var) if pooled_var else 0.0


def auc(positive: list[float], negative: list[float]) -> float:
    wins = 0.0
    for pos in positive:
        for neg in negative:
            wins += 1.0 if pos > neg else 0.5 if pos == neg else 0.0
    return wins / (len(positive) * len(negative))


def render_top_features_svg(ranking: list[dict], output: Path) -> None:
    """Render a dependency-free, deterministic summary chart."""
    top = ranking[:10]
    width = 920
    height = 118 + 44 * len(top)
    left = 150
    bar_width = 620
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        '<title id="title">Top protein features by univariate discrimination AUC</title>',
        '<desc id="desc">Horizontal bars for the ten highest-ranked synthetic protein features. P001 through P008 are embedded positive controls.</desc>',
        '<rect width="100%" height="100%" rx="18" fill="#f6f8fa"/>',
        '<text x="34" y="42" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#172321">Top synthetic change signals</text>',
        '<text x="34" y="70" font-family="system-ui, sans-serif" font-size="14" fill="#57606a">Week 12 minus baseline · ranked by |Welch t| · bar length shows AUC above chance</text>',
    ]
    for index, item in enumerate(top):
        y = 101 + index * 44
        auc_value = item["discrimination_auc"]
        scaled = max(0.0, min(1.0, (auc_value - 0.5) / 0.5))
        rendered_width = scaled * bar_width
        is_control = int(item["protein"][1:]) <= 8
        color = "#1f6a59" if is_control else "#4e7192"
        parts.extend(
            [
                f'<text x="34" y="{y + 20}" font-family="ui-monospace, monospace" font-size="15" font-weight="700" fill="#172321">{item["protein"]}</text>',
                f'<rect x="{left}" y="{y}" width="{bar_width}" height="26" rx="6" fill="#d8dee4"/>',
                f'<rect x="{left}" y="{y}" width="{rendered_width:.2f}" height="26" rx="6" fill="{color}"/>',
                f'<text x="{left + bar_width + 18}" y="{y + 19}" font-family="system-ui, sans-serif" font-size="14" fill="#172321">{auc_value:.3f}</text>',
            ]
        )
    legend_y = height - 18
    parts.extend(
        [
            f'<circle cx="34" cy="{legend_y - 5}" r="6" fill="#1f6a59"/>',
            f'<text x="48" y="{legend_y}" font-family="system-ui, sans-serif" font-size="12" fill="#57606a">embedded control</text>',
            f'<circle cx="180" cy="{legend_y - 5}" r="6" fill="#4e7192"/>',
            f'<text x="194" y="{legend_y}" font-family="system-ui, sans-serif" font-size="12" fill="#57606a">other feature</text>',
            "</svg>",
        ]
    )
    output.write_text("\n".join(parts) + "\n", encoding="utf-8")


def analyse(input_path: Path, results_dir: Path) -> dict:
    rows = read_rows(input_path)
    corrected = batch_correct(rows)
    groups = {row["patient_id"]: row["group"] for row in rows}
    observed: dict[tuple[str, str, str], float] = {}
    for (patient, timepoint, protein, _group), value in corrected.items():
        observed[(patient, timepoint, protein)] = value

    deltas: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for patient, group in groups.items():
        proteins = {key[2] for key in observed if key[0] == patient}
        for protein in proteins:
            baseline = observed.get((patient, "baseline", protein))
            week12 = observed.get((patient, "week12", protein))
            if baseline is not None and week12 is not None:
                deltas[protein][group].append(week12 - baseline)

    ranking = []
    for protein, by_group in deltas.items():
        persistent = by_group.get("persistent", [])
        recovered = by_group.get("recovered", [])
        if len(persistent) < 10 or len(recovered) < 10:
            continue
        raw_auc = auc(persistent, recovered)
        ranking.append(
            {
                "protein": protein,
                "n_persistent": len(persistent),
                "n_recovered": len(recovered),
                "mean_delta_persistent": statistics.fmean(persistent),
                "mean_delta_recovered": statistics.fmean(recovered),
                "cohen_d": cohen_d(persistent, recovered),
                "welch_t": welch_t(persistent, recovered),
                "discrimination_auc": max(raw_auc, 1.0 - raw_auc),
            }
        )
    ranking.sort(key=lambda item: (abs(item["welch_t"]), item["protein"]), reverse=True)

    results_dir.mkdir(parents=True, exist_ok=True)
    fieldnames = list(ranking[0])
    with (results_dir / "feature_ranking.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for item in ranking:
            writer.writerow(
                {
                    key: f"{value:.6f}" if isinstance(value, float) else value
                    for key, value in item.items()
                }
            )

    summary = {
        "synthetic_data": True,
        "input_rows": len(rows),
        "patients": len(groups),
        "proteins": len({row["protein"] for row in rows}),
        "timepoints": [
            timepoint
            for timepoint in ("baseline", "week4", "week12")
            if timepoint in {row["timepoint"] for row in rows}
        ],
        "missing_measurements": sum(row["npx"] is None for row in rows),
        "complete_delta_features": len(ranking),
        "top_features": [item["protein"] for item in ranking[:10]],
    }
    (results_dir / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    render_top_features_svg(ranking, results_dir / "top_features.svg")
    top_rows = "\n".join(
        f"| {index} | {item['protein']} | {item['cohen_d']:.2f} | {item['discrimination_auc']:.3f} |"
        for index, item in enumerate(ranking[:10], start=1)
    )
    report = f"""# Synthetic longitudinal proteomics analysis

## Scope

This report is generated from synthetic data. It demonstrates a reproducible workflow and is not clinical evidence or a diagnostic model.

## Quality control

- Input rows: {summary['input_rows']:,}
- Synthetic participants: {summary['patients']}
- Protein features: {summary['proteins']}
- Timepoints: {', '.join(summary['timepoints'])}
- Missing measurements: {summary['missing_measurements']}
- Features with adequate paired deltas: {summary['complete_delta_features']}

## Strongest week-12 change signals

| Rank | Protein | Cohen's d | Univariate AUC |
|---:|---|---:|---:|
{top_rows}

## Interpretation limits

The generator intentionally embeds group-associated signals in P001-P008. Recovery of these controls tests whether the pipeline behaves as expected; it does not validate a real-world biomarker. Batch centering is included for demonstration and would require study-specific diagnostics and sensitivity analysis in a clinical project.
"""
    (results_dir / "report.md").write_text(report, encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("data/synthetic_proteomics.csv"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    summary = analyse(args.input, args.results_dir)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
