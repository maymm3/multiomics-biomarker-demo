# Contributing and review checklist

Contributions that improve reproducibility, validation, documentation, or statistical clarity are welcome.

Before opening a pull request:

1. Run `make reproduce`.
2. Confirm `git diff --exit-code -- data results` passes after generation.
3. Add or update a test for behavioral changes.
4. Keep the project dependency-free unless a new dependency materially improves the analysis.
5. Label synthetic results and limitations clearly.
6. Never add real participant data, credentials, confidential employer code, or unpublished research outputs.

Scientific interpretation remains subject to human review.
