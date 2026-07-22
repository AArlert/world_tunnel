# 薄转发层：真正逻辑在 npm scripts 与 scripts/*.py（GNU make 3.81 兼容，只用基础语法）
.PHONY: dev build preview test e2e lint regress handover next docs-check docs-archive pin-spec bump evidence

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

test:
	node scripts/regress.mjs --unit "$(TEST)"

e2e:
	node scripts/regress.mjs --e2e "$(TEST)"

lint:
	node scripts/regress.mjs --lint

regress:
	node scripts/regress.mjs --all

handover:
	python scripts/docs.py --handover

next:
	python scripts/docs.py --next

docs-check:
	python scripts/docs.py --check

docs-archive:
	python scripts/docs.py --archive

pin-spec:
	python scripts/docs.py --pin-spec

bump:
	python scripts/bump.py $(if $(MILESTONE),--milestone $(MILESTONE))

evidence:
	python scripts/evidence.py $(if $(SCEN),--scen $(SCEN)) $(if $(BUG),--bug $(BUG)) $(if $(REGRESS),--regress) $(if $(TEST),--test $(TEST)) $(if $(E2E),--e2e) $(if $(DO_LINT),--lint) $(if $(SHOT),--shot $(SHOT)) $(if $(SPEC_REF),--spec-ref $(SPEC_REF))
