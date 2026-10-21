# GitHub Actions CI/CD 파이프라인

## 프로젝트 구조 개요

```
.github/
├── workflows/
│   ├── ci.yml
│   ├── deploy-staging.yml
│   └── deploy-production.yml
├── actions/
│   ├── setup-node/
│   │   └── action.yml
│   ├── docker-build-push/
│   │   └── action.yml
│   └── health-check/
│       └── action.yml
└── scripts/
    ├── health-check.sh
    └── slack-notify.sh
```

---

## 1. CI 파이프라인 (PR 검증)

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  pull_request:
    branches:
      - main
      - develop
      - 'release/**'
    types:
      - opened
      - synchronize
      - reopened
  push:
    branches:
      - develop

# 같은 PR에 대한 중복 실행 취소
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20.x'
  PYTHON_VERSION: '3.11'
  PNPM_VERSION: '8'

jobs:
  # ─────────────────────────────────────────
  # Job 1: 변경 파일 감지 (불필요한 잡 스킵)
  # ─────────────────────────────────────────
  changes:
    name: 🔍 Detect Changes
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      infra: ${{ steps.filter.outputs.infra }}
      docker: ${{ steps.filter.outputs.docker }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Filter paths
        uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
              - 'packages/shared/**'
            frontend:
              - 'frontend/**'
              - 'packages/shared/**'
            infra:
              - 'terraform/**'
              - '.github/workflows/**'
            docker:
              - '**/Dockerfile*'
              - 'docker-compose*.yml'

  # ─────────────────────────────────────────
  # Job 2: 백엔드 린트 & 타입체크
  # ─────────────────────────────────────────
  backend-lint:
    name: 🔧 Backend Lint & Type Check
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.backend == 'true' || github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: 'backend/pnpm-lock.yaml'

      - name: Install dependencies
        working-directory: backend
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        working-directory: backend
        run: |
          pnpm lint --format=@microsoft/eslint-formatter-sarif \
            --output-file=eslint-results.sarif || true
          pnpm lint

      - name: Upload ESLint SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: backend/eslint-results.sarif
          category: eslint-backend

      - name: TypeScript type check
        working-directory: backend
        run: pnpm type-check

      - name: Check formatting (Prettier)
        working-directory: backend
        run: pnpm format:check

  # ─────────────────────────────────────────
  # Job 3: 프론트엔드 린트 & 타입체크
  # ─────────────────────────────────────────
  frontend-lint:
    name: 🎨 Frontend Lint & Type Check
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.frontend == 'true' || github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: 'frontend/pnpm-lock.yaml'

      - name: Install dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        working-directory: frontend
        run: pnpm lint

      - name: TypeScript type check
        working-directory: frontend
        run: pnpm type-check

      - name: Check formatting
        working-directory: frontend
        run: pnpm format:check

  # ─────────────────────────────────────────
  # Job 4: 백엔드 유닛 테스트
  # ─────────────────────────────────────────
  backend-test-unit:
    name: 🧪 Backend Unit Tests
    runs-on: ubuntu-latest
    needs: [changes, backend-lint]
    if: needs.changes.outputs.backend == 'true' || github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: 'backend/pnpm-lock.yaml'

      - name: Install dependencies
        working-directory: backend
        run: pnpm install --frozen-lockfile

      - name: Run unit tests with coverage
        working-directory: backend
        run: |
          pnpm test:unit --coverage \
            --coverageReporters=lcov \
            --coverageReporters=json-summary \
            --coverageThreshold='{"global":{"lines":70,"functions":70,"branches":65,"statements":70}}'
        env:
          NODE_ENV: test

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: backend/coverage/lcov.info
          flags: backend-unit
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false

      - name: Comment coverage on PR
        uses: MishaKav/jest-coverage-comment@main
        if: github.event_name == 'pull_request'
        with:
          coverage-summary-path: backend/coverage/coverage-summary.json
          title: 'Backend Test Coverage'
          badge-title: Coverage
          hide-comment: false

  # ─────────────────────────────────────────
  # Job 5: 백엔드 통합 테스트
  # ─────────────────────────────────────────
  backend-test-integration:
    name: 🔗 Backend Integration Tests
    runs-on: ubuntu-latest
    needs: [changes, backend-lint]
    if: needs.changes.outputs.backend == 'true' || github.event_name == 'push'

    # 통합 테스트용 서비스 컨테이너
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: hyperlocal_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: 'backend/pnpm-lock.yaml'

      - name: Install dependencies
        working-directory: backend
        run: pnpm install --frozen-lockfile

      - name: Run database migrations
        working-directory: backend
        run: pnpm migration:run
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/hyperlocal_test
          NODE_ENV: test

      - name: Run integration tests
        working-directory: backend
        run: pnpm test:integration --forceExit
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/hyperlocal_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret-key-for-ci
          AWS_REGION: ap-northeast-2

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-test-results
          path: backend/test-results/
          retention-days: 7

  # ─────────────────────────────────────────
  # Job 6: 프론트엔드 테스트
  # ─────────────────────────────────────────
  frontend-test:
    name: 🧪 Frontend Tests
    runs-on: ubuntu-latest
    needs: [changes, frontend-lint]
    if: needs.changes.outputs.frontend == 'true' || github.event_name == 'push'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: 'frontend/pnpm-lock.yaml'

      - name: Install dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Run tests
        working-directory: frontend
        run: pnpm test --coverage --watchAll=false
        env:
          CI: true

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: frontend/coverage/lcov.info
          flags: frontend
          token: ${{ secrets.CODECOV_TOKEN }}

  # ─────────────────────────────────────────
  # Job 7: 보안 스캔 (Snyk)
  # ─────────────────────────────────────────
  security-scan:
    name: 🔒 Security Scan (Snyk)
    runs-on: ubuntu-latest
    needs: changes
    permissions:
      security-events: write
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install backend dependencies
        working-directory: backend
        run: pnpm install --frozen-lockfile

      - name: Install frontend dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      # 의존성 취약점 스캔
      - name: Snyk - Backend dependency scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: >
            --severity-threshold=high
            --sarif-file-output=snyk-backend.sarif
            --file=backend/package.json

      - name: Snyk - Frontend dependency scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: >
            --severity-threshold=high
            --sarif-file-output=snyk-frontend.sarif
            --file=frontend/package.json

      # 코드 취약점 스캔
      - name: Snyk - Code scan (SAST)
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: code test
          args: >
            --severity-threshold=high
            --sarif-file-output=snyk-code.sarif

      - name: Upload Snyk results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: |
            snyk-backend.sarif
            snyk-frontend.sarif
            snyk-code.sarif

      # secrets 노출 스캔
      - name: Run Gitleaks (Secret scanning)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

  # ─────────────────────────────────────────
  # Job 8: Docker 이미지 빌드 검증
  # ─────────────────────────────────────────
  docker-build-validate:
    name: 🐳 Docker Build Validation
    runs-on: ubuntu-latest
    needs: changes
    if: |
      needs.changes.outputs.backend == 'true' ||
      needs.changes.outputs.frontend == 'true' ||
      needs.changes.outputs.docker == 'true'

    strategy:
      matrix:
        service: [backend, frontend]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image (validation only)
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          file: ./${{ matrix.service }}/Dockerfile
          push: false
          cache-from: type=gha,scope=${{ matrix.service }}-ci
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}-ci
          build-args: |
            NODE_ENV=production
            BUILD_VERSION=${{ github.sha }}

      # Trivy 컨테이너 이미지 취약점 스캔
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'local/${{ matrix.service }}:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-${{ matrix.service }}.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '0'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-${{ matrix.service }}.sarif
          category: trivy-${{ matrix.service }}

  # ─────────────────────────────────────────
  # Job 9: CI 최종 결과 집계
  # ─────────────────────────────────────────
  ci-summary:
    name: ✅ CI Summary
    runs-on: ubuntu-latest
    needs:
      - backend-test-unit
      - backend-test-integration
      - frontend-test
      - security-scan
      - docker-build-validate
    if: always()

    steps:
      - name: Check all jobs status
        run: |
          echo "=== CI Pipeline Summary ==="
          echo "Backend Unit Tests: ${{ needs.backend-test-unit.result }}"
          echo "Backend Integration Tests: ${{ needs.backend-test-integration.result }}"
          echo "Frontend Tests: ${{ needs.frontend-test.result }}"
          echo "Security Scan: ${{ needs.security-scan.result }}"
          echo "Docker Build: ${{ needs.docker-build-validate.result }}"

          # 실패한 critical job이 있으면 파이프라인 실패
          if [[ "${{ needs.backend-test-unit.result }}" == "failure" || \
                "${{ needs.backend-test-integration.result }}" == "failure" || \
                "${{ needs.frontend-test.result }}" == "failure" ]]; then
            echo "❌ Critical jobs failed!"
            exit 1
          fi

          echo "✅ All critical checks passed!"

      - name: Notify Slack on CI failure
        if: failure() && github.event_name == 'pull_request'
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: |
            {
              "text": "❌ CI 파이프라인 실패",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "❌ CI Pipeline Failed"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*PR:*\n<${{ github.event.pull_request.html_url }}|${{ github.event.pull_request.title }}>"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Author:*\n${{ github.event.pull_request.user.login }}"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Branch:*\n`${{ github.head_ref }}`"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*Commit:*\n`${{ github.sha }}`"
                    }
                  ]
                },
                {
                  "type": "actions",
                  "elements": [
                    {
                      "type": "button",
                      "text": {"type": "plain_text", "text": "🔍 View Run"},
                      "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                    }
                  ]
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_CI }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

---

## 2. 스테이징 배포 파이프라인

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches:
      - develop
  workflow_dispatch:
    inputs:
      service:
        description: '배포할 서비스 (all/backend/frontend)'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - backend
          - frontend
      skip_tests:
        description: '테스트 스킵 (긴급 배포용)'
        required: false
        default: false
        type: boolean

concurrency:
  group: deploy-staging
  cancel-in-progress: false  # 스테이징 배포는 순서 보장

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-northeast-2.amazonaws.com
  ECS_CLUSTER: hyperlocal-staging
  ENVIRONMENT: staging
  NODE_VERSION: '20.x'
  PNPM_VERSION: '8'

jobs:
  # ─────────────────────────────────────────
  # Job 1: 사전 검증
  # ─────────────────────────────────────────
  pre-deploy-checks:
    name: 🔍 Pre-Deploy Checks
    runs-on: ubuntu-latest
    outputs:
      deploy_backend: ${{ steps.set-matrix.outputs.deploy_backend }}
      deploy_frontend: ${{ steps.set-matrix.outputs.deploy_frontend }}
      image_tag: ${{ steps.set-tag.outputs.tag }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set image tag
        id: set-tag
        run: |
          SHORT_SHA=$(git rev-parse --short HEAD)
          TIMESTAMP=$(date +%Y%m%d%H%M%S)
          TAG="${TIMESTAMP}-${SHORT_SHA}"
          echo "tag=${TAG}" >> $GITHUB_OUTPUT
          echo "🏷️ Image tag: ${TAG}"

      - name: Set deploy matrix
        id: set-matrix
        run: |
          INPUT="${{ github.event.inputs.service || 'all' }}"
          if [[ "$INPUT" == "all" || "$INPUT" == "backend" ]]; then
            echo "deploy_backend=true" >> $GITHUB_OUTPUT
          else
            echo "deploy_backend=false" >> $GITHUB_OUTPUT
          fi
          if [[ "$INPUT" == "all" || "$INPUT" == "frontend" ]]; then
            echo "deploy_frontend=true" >> $GITHUB_OUTPUT
          else
            echo "deploy_frontend=false" >> $GITHUB_OUTPUT
          fi

      - name: Validate AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Verify ECS cluster exists
        run: |
          aws ecs describe-clusters \
            --clusters ${{ env.ECS_CLUSTER }} \
            --query 'clusters[0].status' \
            --output text | grep -q "ACTIVE"
          echo "✅ ECS cluster is active"

  # ─────────────────────────────────────────
  # Job 2: 백엔드 이미지 빌드 & ECR 푸시
  # ─────────────────────────────────────────
  build-push-backend:
    name: 🐳 Build & Push Backend
    runs-on: ubuntu-latest
    needs: pre-deploy-checks
    if: needs.pre-deploy-checks.outputs.deploy_backend == 'true'
    outputs:
      image_uri: ${{ steps.build.outputs.image_uri }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push backend image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/hyperlocal-backend:${{ needs.pre-deploy-checks.outputs.image_tag }}
            ${{ env.ECR_REGISTRY }}/hyperlocal-backend:staging-latest
          cache-from: type=gha,scope=backend-staging
          cache-to: type=gha,mode=max,scope=backend-staging
          build-args: |
            NODE_ENV=staging
            BUILD_VERSION=${{ needs.pre-deploy-checks.outputs.image_tag }}
            COMMIT_SHA=${{ github.sha }}
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.created=${{ github.event.head_commit.timestamp }}
            environment=staging

      - name: Output image URI
        id: set-output
        run: |
          IMAGE_URI="${{ env.ECR_REGISTRY }}/hyperlocal-backend:${{ needs.pre-deploy-checks.outputs.image_tag }}"
          echo "image_uri=${IMAGE_URI}" >> $GITHUB_OUTPUT
          echo "✅ Backend image pushed: ${IMAGE_URI}"

      # ECR 이미지 취약점 스캔 결과 확인
      - name: Wait for ECR scan and check results
        run: |
          echo "🔍 Checking ECR image scan results..."
          sleep 30  # 스캔 완료 대기

          CRITICAL=$(aws ecr describe-image-scan-findings \
            --repository-name hyperlocal-backend \
            --image-id imageTag=${{ needs.pre-deploy-checks.outputs.image_tag }} \
            --query 'imageScanFindings.findingSeverityCounts.CRITICAL' \
            --output text 2>/dev/null || echo "0")

          if [[ "$CRITICAL" != "None" && "$CRITICAL" -gt 0 ]]; then
            echo "⚠️ Warning: ${CRITICAL} CRITICAL vulnerabilities found"
            # 스테이징은 경고만 (프로덕션은 차단)
          else
            echo "✅ No critical vulnerabilities found"
          fi

  # ─────────────────────────────────────────
  # Job 3: 프론트엔드 이미지 빌드 & ECR 푸시
  # ─────────────────────────────────────────
  build-push-frontend:
    name: 🐳 Build & Push Frontend
    runs-on: ubuntu-latest
    needs: pre-deploy-checks
    if: needs.pre-deploy-checks.outputs.deploy_frontend == 'true'
    outputs:
      image_uri: ${{ steps.set-output.outputs.image_uri }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/hyperlocal-frontend:${{ needs.pre-deploy-checks.outputs.image_tag }}
            ${{ env.ECR_REGISTRY }}/hyperlocal-frontend:staging-latest
          cache-from: type=gha,scope=frontend-staging
          cache-to: type=gha,mode=max,scope=frontend-staging
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.STAGING_API_URL }}
            NEXT_PUBLIC_ENV=staging
            BUILD_VERSION=${{ needs.pre-deploy-checks.outputs.image_tag }}

      - name: Output image URI
        id: set-output
        run: |
          IMAGE_URI="${{ env.ECR_REGISTRY }}/hyperlocal-frontend:${{ needs.pre-deploy-checks.outputs.image_tag }}"
          echo "image_uri=${IMAGE_URI}" >> $GITHUB_OUTPUT
          echo "✅ Frontend image pushed: ${IMAGE_URI}"

  # ─────────────────────────────────────────
  # Job 4: 스테이징 배포 시작 알림
  # ─────────────────────────────────────────
  notify-deploy-start:
    name: 📢 Notify Deploy Start
    runs-on: ubuntu-latest
    needs: [pre-deploy-checks, build-push-backend, build-push-frontend]
    if: always() && !failure() && !cancelled()

    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: |
            {
              "text": "🚀 스테이징 배포 시작",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "🚀 Staging 배포 시작"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*환경:*\nStaging"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*버전:*\n`${{ needs.pre-deploy-checks.outputs.image_tag }}`"
                    },