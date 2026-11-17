.PHONY: help install dev lint typecheck build docker-build helm-lint tf-validate

IMAGE_NAME ?= ghcr.io/neon-chasm/observability-engine
IMAGE_TAG ?= v2.1.0
HELM_CHART_DIR ?= ./deploy/helm/neon-chasm
TERRAFORM_DIR ?= ./deploy/terraform

help: ## Show available build, verification, and deployment targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install pinned workspace dependencies
	@if command -v bun >/dev/null 2>&1; then \
		bun install --frozen-lockfile; \
	else \
		npm ci; \
	fi

dev: ## Start Next.js observability console on port 3000
	npx next dev -p 3000

lint: ## Run strict ESLint verification across all workspace sources
	npx eslint .

typecheck: ## Run strict TypeScript compiler checks with zero emit
	npx tsc --noEmit

build: ## Build production Next.js bundle and API bridges
	npm run build

docker-build: ## Build hardened multi-stage non-root container image with BuildKit
	DOCKER_BUILDKIT=1 docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -t $(IMAGE_NAME):latest .

helm-lint: ## Lint Kubernetes Restricted PSS Helm chart
	@if command -v helm >/dev/null 2>&1; then \
		helm lint $(HELM_CHART_DIR); \
	else \
		echo "[helm-lint] helm binary not found in PATH; install Helm v3+ to validate $(HELM_CHART_DIR)"; \
		exit 1; \
	fi

tf-validate: ## Format-check and validate modular multi-AZ Terraform IaC
	@if command -v terraform >/dev/null 2>&1; then \
		terraform -chdir=$(TERRAFORM_DIR) fmt -check -recursive && \
		terraform -chdir=$(TERRAFORM_DIR) init -backend=false && \
		terraform -chdir=$(TERRAFORM_DIR) validate; \
	else \
		echo "[tf-validate] terraform binary not found in PATH"; \
		exit 1; \
	fi
