import csv
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from analyze import analyse, read_rows  # noqa: E402
from generate_data import N_PATIENTS, N_PROTEINS, TIMEPOINTS, generate  # noqa: E402


class PipelineTest(unittest.TestCase):
    def test_generator_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.csv"
            second = Path(directory) / "second.csv"
            generate(first)
            generate(second)
            self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_schema_and_expected_row_count(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.csv"
            stats = generate(path)
            self.assertEqual(stats["rows"], N_PATIENTS * N_PROTEINS * len(TIMEPOINTS))
            rows = read_rows(path)
            self.assertEqual(len(rows), stats["rows"])

    def test_pipeline_recovers_embedded_positive_controls(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / "data.csv"
            results = Path(directory) / "results"
            generate(data)
            summary = analyse(data, results)
            embedded = {f"P{index:03d}" for index in range(1, 9)}
            recovered = embedded.intersection(summary["top_features"])
            self.assertGreaterEqual(len(recovered), 6)
            self.assertTrue((results / "feature_ranking.csv").exists())
            with (results / "feature_ranking.csv").open(newline="", encoding="utf-8") as handle:
                self.assertEqual(len(list(csv.DictReader(handle))), N_PROTEINS)


if __name__ == "__main__":
    unittest.main()
