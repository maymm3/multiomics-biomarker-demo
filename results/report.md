# Synthetic longitudinal proteomics analysis

## Scope

This report is generated from synthetic data. It demonstrates a reproducible workflow and is not clinical evidence or a diagnostic model.

## Quality control

- Input rows: 8,640
- Synthetic participants: 72
- Protein features: 40
- Timepoints: baseline, week4, week12
- Missing measurements: 128
- Features with adequate paired deltas: 40

## Strongest week-12 change signals

| Rank | Protein | Cohen's d | Univariate AUC |
|---:|---|---:|---:|
| 1 | P003 | 2.82 | 0.973 |
| 2 | P001 | 2.66 | 0.974 |
| 3 | P004 | 2.45 | 0.969 |
| 4 | P002 | 2.41 | 0.944 |
| 5 | P005 | 2.08 | 0.930 |
| 6 | P007 | -1.88 | 0.905 |
| 7 | P006 | -1.34 | 0.824 |
| 8 | P008 | -1.28 | 0.817 |
| 9 | P031 | 0.60 | 0.674 |
| 10 | P027 | 0.53 | 0.642 |

## Interpretation limits

The generator intentionally embeds group-associated signals in P001-P008. Recovery of these controls tests whether the pipeline behaves as expected; it does not validate a real-world biomarker. Batch centering is included for demonstration and would require study-specific diagnostics and sensitivity analysis in a clinical project.
