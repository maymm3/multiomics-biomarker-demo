.PHONY: generate analyse test reproduce check

generate:
	python3 src/generate_data.py

analyse:
	python3 src/analyze.py

test:
	python3 -m unittest discover -s tests -v
	node --test tests/test_site.mjs

reproduce: generate analyse test

check: reproduce
	git diff --exit-code -- data results
