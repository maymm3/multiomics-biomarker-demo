#!/usr/bin/env python3
"""Generate a deterministic, synthetic longitudinal proteomics dataset."""

from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


TIMEPOINTS = ("baseline", "week4", "week12")
N_PATIENTS = 72
N_PROTEINS = 40
SEED = 20260828


def generate(output: Path, seed: int = SEED) -> dict[str, int]:
    rng = random.Random(seed)
    output.parent.mkdir(parents=True, exist_ok=True)
    missing = 0
    rows = 0
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=("patient_id", "group", "batch", "timepoint", "protein", "npx"),
        )
        writer.writeheader()
        for patient_index in range(N_PATIENTS):
            group = "persistent" if patient_index < N_PATIENTS // 2 else "recovered"
            batch = "A" if patient_index % 2 == 0 else "B"
            patient_shift = rng.gauss(0, 0.30)
            for time_index, timepoint in enumerate(TIMEPOINTS):
                for protein_index in range(1, N_PROTEINS + 1):
                    protein = f"P{protein_index:03d}"
                    protein_center = 4.8 + protein_index * 0.025
                    time_shift = (0.05, 0.12, 0.18)[time_index]
                    batch_shift = 0.22 if batch == "B" else -0.22
                    signal = 0.0
                    if group == "persistent" and protein_index <= 5:
                        signal = (0.0, 0.70, 1.45)[time_index]
                    if group == "persistent" and 6 <= protein_index <= 8:
                        signal = (0.0, -0.35, -0.75)[time_index]
                    value = protein_center + patient_shift + time_shift + batch_shift + signal
                    value += rng.gauss(0, 0.38)
                    if rng.random() < 0.012:
                        rendered = ""
                        missing += 1
                    else:
                        rendered = f"{value:.5f}"
                    writer.writerow(
                        {
                            "patient_id": f"SYN{patient_index + 1:03d}",
                            "group": group,
                            "batch": batch,
                            "timepoint": timepoint,
                            "protein": protein,
                            "npx": rendered,
                        }
                    )
                    rows += 1
    return {"rows": rows, "missing_values": missing, "seed": seed}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/synthetic_proteomics.csv"))
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    stats = generate(args.output, args.seed)
    print(f"Generated {stats['rows']} rows at {args.output} (seed={stats['seed']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
