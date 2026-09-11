# HyperLocal Mission Platform - 모니터링/로깅/보안 설정

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
│                                                             │
│  CloudFront + WAF                                           │
│       ↓                                                     │
│  ALB (Application Load Balancer)                            │
│       ↓                                                     │
│  ECS Fargate Cluster                                        │
│  ├── API Service (Next.js/FastAPI)                          │
│  ├── Worker Service (미션 검수)                              │
│  └── Scheduler Service (크론)                               │
│       ↓                                                     │
│  ├── RDS PostgreSQL (Multi-AZ)                              │
│  ├── ElastiCache Redis                                      │
│  └── S3 (콘텐츠 저장)                                       │
│                                                             │
│  모니터링 스택:                                              │
│  CloudWatch + Prometheus + Grafana                          │
│  ELK Stack (로그)                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 모니터링 설정

### 1.1 CloudWatch 알람 설정

```hcl
# terraform/modules/monitoring/cloudwatch_alarms.tf

locals {
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  
  # 심각도별 임계값
  thresholds = {
    # API 응답 시간
    api_latency_p95_warning  = 1000  # ms
    api_latency_p95_critical = 2000  # ms
    
    # 에러율
    error_rate_warning  = 1    # %
    error_rate_critical = 5    # %
    
    # 리소스 사용률
    cpu_warning  = 70  # %
    cpu_critical = 85  # %
    
    memory_warning  = 75  # %
    memory_critical = 90  # %
    
    # DB 연결
    db_connections_warning  = 80   # %
    db_connections_critical = 95   # %
  }
}

# ────────────────────────────────────────────
# SNS 알림 토픽 (심각도별 분리)
# ────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "hyperlocal-alerts-${var.environment}"
  kms_master_key_id = aws_kms_key.sns.id
  
  tags = var.common_tags
}

resource "aws_sns_topic" "critical_alerts" {
  name              = "hyperlocal-critical-alerts-${var.environment}"
  kms_master_key_id = aws_kms_key.sns.id
  
  tags = var.common_tags
}

# Slack 웹훅 연동 (Lambda를 통한 포맷팅)
resource "aws_sns_topic_subscription" "slack_warning" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier.arn
}

resource "aws_sns_topic_subscription" "slack_critical" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier.arn
}

# PagerDuty 연동 (critical only)
resource "aws_sns_topic_subscription" "pagerduty_critical" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "https"
  endpoint  = var.pagerduty_endpoint
}

# ────────────────────────────────────────────
# ECS 서비스 모니터링
# ────────────────────────────────────────────

# API 서비스 CPU
resource "aws_cloudwatch_metric_alarm" "api_cpu_warning" {
  alarm_name          = "hyperlocal-api-cpu-warning-${var.environment}"
  alarm_description   = "API 서비스 CPU 사용률 경고 (>70%)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3  # 연속 3회 초과 시 알람
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60  # 60초 간격
  statistic           = "Average"
  threshold           = local.thresholds.cpu_warning
  
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
  
  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_cpu_critical" {
  alarm_name          = "hyperlocal-api-cpu-critical-${var.environment}"
  alarm_description   = "API 서비스 CPU 사용률 위험 (>85%) - 즉시 대응 필요"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2  # 연속 2회 초과 시 즉시 알람
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = local.thresholds.cpu_critical
  
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

# API 응답 지연 (ALB 기준)
resource "aws_cloudwatch_metric_alarm" "alb_latency_p95" {
  alarm_name          = "hyperlocal-alb-latency-p95-${var.environment}"
  alarm_description   = "ALB P95 응답 시간 2초 초과"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  extended_statistic  = "p95"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  threshold           = 2  # 2초
  
  dimensions = {
    LoadBalancer = aws_alb.main.arn_suffix
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

# 5xx 에러율
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "hyperlocal-alb-5xx-rate-${var.environment}"
  alarm_description   = "5xx 에러율 5% 초과"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = local.thresholds.error_rate_critical
  
  metric_query {
    id          = "error_rate"
    expression  = "errors / requests * 100"
    label       = "5xx Error Rate"
    return_data = true
  }
  
  metric_query {
    id = "errors"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_alb.main.arn_suffix
      }
    }
  }
  
  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_alb.main.arn_suffix
      }
    }
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

# RDS 모니터링
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "hyperlocal-rds-cpu-${var.environment}"
  alarm_description   = "RDS CPU 85% 초과"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "hyperlocal-rds-storage-${var.environment}"
  alarm_description   = "RDS 여유 스토리지 5GB 미만"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120  # 5GB in bytes
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "hyperlocal-rds-connections-${var.environment}"
  alarm_description   = "RDS 연결 수 80% 초과"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80  # max_connections의 80%
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  alarm_actions = local.alarm_actions
  
  tags = var.common_tags
}

# ElastiCache 모니터링
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "hyperlocal-redis-memory-${var.environment}"
  alarm_description   = "Redis 메모리 사용률 85% 초과"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  
  dimensions = {
    CacheClusterId = aws_elasticache_cluster.main.id
  }
  
  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  
  tags = var.common_tags
}

# 비즈니스 메트릭 알람
resource "aws_cloudwatch_metric_alarm" "mission_submission_drop" {
  alarm_name          = "hyperlocal-mission-submission-drop-${var.environment}"
  alarm_description   = "미션 제출 수 급감 (1시간 대비 50% 이상 감소)"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  threshold           = 50  # 이전 시간 대비 50%
  
  metric_query {
    id          = "submission_rate"
    expression  = "(current / FILL(previous, 1)) * 100"
    label       = "Mission Submission Rate"
    return_data = true
  }
  
  metric_query {
    id = "current"
    metric {
      metric_name = "MissionSubmissionCount"
      namespace   = "HyperLocal/Business"
      period      = 3600
      stat        = "Sum"
    }
  }
  
  metric_query {
    id = "previous"
    metric {
      metric_name = "MissionSubmissionCount"
      namespace   = "HyperLocal/Business"
      period      = 3600
      stat        = "Sum"
    }
  }
  
  alarm_actions = local.alarm_actions
  
  tags = var.common_tags
}
```

### 1.2 커스텀 메트릭 발행 (애플리케이션 코드)

```python
# src/utils/metrics.py
import boto3
import time
from functools import wraps
from contextlib import contextmanager
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class CloudWatchMetrics:
    """비즈니스/애플리케이션 커스텀 메트릭 발행"""
    
    def __init__(self, namespace: str = "HyperLocal/Business"):
        self.cloudwatch = boto3.client('cloudwatch', region_name='ap-northeast-2')
        self.namespace = namespace
        self._buffer: list = []
        self._buffer_size = 20  # CloudWatch 배치 제한
    
    def put_metric(
        self,
        metric_name: str,
        value: float,
        unit: str = "Count",
        dimensions: Optional[Dict[str, str]] = None
    ):
        """메트릭 발행 (버퍼링 후 배치 전송)"""
        metric_data = {
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Dimensions': [
                {'Name': k, 'Value': v}
                for k, v in (dimensions or {}).items()
            ]
        }
        
        self._buffer.append(metric_data)
        
        if len(self._buffer) >= self._buffer_size:
            self._flush()
    
    def _flush(self):
        """버퍼 플러시"""
        if not self._buffer:
            return
        
        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.namespace,
                MetricData=self._buffer
            )
            self._buffer = []
        except Exception as e:
            logger.error(f"메트릭 발행 실패: {e}")
    
    # ── 비즈니스 메트릭 ──────────────────────────
    
    def track_mission_submitted(self, mission_type: str, region: str):
        self.put_metric(
            "MissionSubmissionCount",
            1,
            dimensions={"MissionType": mission_type, "Region": region}
        )
    
    def track_mission_approved(self, mission_type: str, review_time_seconds: float):
        self.put_metric("MissionApprovalCount", 1,
                        dimensions={"MissionType": mission_type})
        self.put_metric("MissionReviewTime", review_time_seconds,
                        unit="Seconds",
                        dimensions={"MissionType": mission_type})
    
    def track_mission_rejected(self, mission_type: str, reason: str):
        self.put_metric("MissionRejectionCount", 1,
                        dimensions={"MissionType": mission_type, "Reason": reason})
    
    def track_user_signup(self, user_type: str):
        self.put_metric("UserSignupCount", 1,
                        dimensions={"UserType": user_type})
    
    def track_reward_payout(self, amount: float, region: str):
        self.put_metric("RewardPayoutAmount", amount,
                        unit="None",
                        dimensions={"Region": region})
    
    def track_active_users(self, count: int):
        self.put_metric("ActiveUserCount", count)
    
    # ── 기술 메트릭 데코레이터 ────────────────────
    
    def track_latency(self, operation_name: str):
        """API 응답 시간 추적 데코레이터"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    status = "success"
                    return result
                except Exception as e:
                    status = "error"
                    raise
                finally:
                    latency_ms = (time.time() - start_time) * 1000
                    self.put_metric(
                        "OperationLatency",
                        latency_ms,
                        unit="Milliseconds",
                        dimensions={
                            "Operation": operation_name,
                            "Status": status
                        }
                    )
            return wrapper
        return decorator


# 전역 인스턴스
metrics = CloudWatchMetrics()
```

### 1.3 Prometheus + Grafana 설정

```yaml
# docker/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'production'
    platform: 'hyperlocal'

# 알람 규칙 파일
rule_files:
  - '/etc/prometheus/rules/*.yml'

# AlertManager 연동
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  # FastAPI 애플리케이션
  - job_name: 'hyperlocal-api'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['api:8000']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  # ECS 컨테이너 메트릭 (CloudWatch Exporter)
  - job_name: 'cloudwatch-exporter'
    static_configs:
      - targets: ['cloudwatch-exporter:9106']

  # RDS 메트릭
  - job_name: 'rds-exporter'
    static_configs:
      - targets: ['rds-exporter:9042']

  # Redis 메트릭
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Nginx/ALB 메트릭
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
```

```yaml
# docker/prometheus/rules/application.yml
groups:
  - name: hyperlocal_application
    rules:
      # API 응답 시간
      - alert: HighAPILatency
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 3m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "API P95 응답 시간 2초 초과"
          description: "{{ $labels.endpoint }} 엔드포인트 P95 응답시간: {{ $value }}s"
          runbook: "https://wiki.hyperlocal.io/runbooks/high-latency"

      # 에러율
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) * 100 > 5
        for: 2m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "5xx 에러율 5% 초과"
          description: "현재 에러율: {{ $value | humanize }}%"
          runbook: "https://wiki.hyperlocal.io/runbooks/high-error-rate"

      # 미션 검수 지연
      - alert: MissionReviewBacklog
        expr: |
          hyperlocal_mission_pending_count > 100
        for: 30m
        labels:
          severity: warning
          team: ops
        annotations:
          summary: "검수 대기 미션 100건 초과"
          description: "현재 대기 중: {{ $value }}건"
      
      # DB 연결 고갈
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          hyperlocal_db_pool_size - hyperlocal_db_pool_available < 5
        for: 1m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "DB 연결 풀 고갈 임박"
          description: "가용 연결: {{ $value }}개"
          runbook: "https://wiki.hyperlocal.io/runbooks/db-connection-pool"

  - name: hyperlocal_business
    rules:
      # 결제 실패율
      - alert: HighPaymentFailureRate
        expr: |
          sum(rate(hyperlocal_payment_failed_total[15m]))
          / sum(rate(hyperlocal_payment_total[15m])) * 100 > 10
        for: 5m
        labels:
          severity: critical
          team: payment
        annotations:
          summary: "결제 실패율 10% 초과"
          description: "즉시 결제 시스템 확인 필요"
          runbook: "https://wiki.hyperlocal.io/runbooks/payment-failure"
```

```yaml
# docker/grafana/dashboards/main-dashboard.json
# Grafana 대시보드 구성 (JSON 모델)
{
  "title": "HyperLocal 플랫폼 메인 대시보드",
  "uid": "hyperlocal-main",
  "tags": ["hyperlocal", "production"],
  "time": {"from": "now-1h", "to": "now"},
  "refresh": "30s",
  
  "panels": [
    # ── Row 1: 비즈니스 현황 ──────────────────────
    {
      "title": "오늘 미션 제출 수",
      "type": "stat",
      "datasource": "Prometheus",
      "targets": [{
        "expr": "sum(increase(hyperlocal_mission_submissions_total[24h]))",
        "legendFormat": "미션 제출"
      }],
      "fieldConfig": {
        "defaults": {
          "color": {"mode": "thresholds"},
          "thresholds": {
            "steps": [
              {"color": "red", "value": 0},
              {"color": "yellow", "value": 50},
              {"color": "green", "value": 100}
            ]
          }
        }
      }
    },
    {
      "title": "검수 승인률",
      "type": "gauge",
      "datasource": "Prometheus",
      "targets": [{
        "expr": |
          sum(rate(hyperlocal_mission_approved_total[1h]))
          / sum(rate(hyperlocal_mission_reviewed_total[1h])) * 100
      }],
      "fieldConfig": {
        "defaults": {
          "min": 0, "max": 100,
          "thresholds": {
            "steps": [
              {"color": "red", "value": 0},
              {"color": "yellow", "value": 70},
              {"color": "green", "value": 80}  # KPI: 80% 이상
            ]
          }
        }
      }
    },
    
    # ── Row 2: API 성능 ───────────────────────────
    {
      "title": "API 응답 시간 (P50/P95/P99)",
      "type": "timeseries",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "P50"
        },
        {
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "P95"
        },
        {
          "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "P99"
        }
      ]
    },
    
    # ── Row 3: 인프라 상태 ────────────────────────
    {
      "title": "ECS CPU/Memory",
      "type": "timeseries",
      "datasource": "CloudWatch",
      "targets": [
        {
          "expression": "SELECT AVG(CPUUtilization) FROM SCHEMA(\"AWS/ECS\", ClusterName, ServiceName)",
          "legendFormat": "CPU"
        }
      ]
    }
  ]
}
```

---

## 2. 중앙화된 로깅 (ELK Stack + CloudWatch Logs)

### 2.1 구조화된 로깅 설정

```python
# src/utils/logging_config.py
import json
import logging
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid


class StructuredFormatter(logging.Formatter):
    """JSON 구조화 로그 포맷터"""
    
    # 민감 정보 마스킹 필드
    SENSITIVE_FIELDS = {
        'password', 'token', 'secret', 'api_key', 
        'credit_card', 'bank_account', 'phone', 'ssn',
        'access_token', 'refresh_token', 'authorization'
    }
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            # 기본 정보
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            
            # 추적 정보
            "trace_id": getattr(record, 'trace_id', None),
            "span_id": getattr(record, 'span_id', None),
            "user_id": getattr(record, 'user_id', None),
            "request_id": getattr(record, 'request_id', None),
            
            # 소스 위치
            "source": {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName
            },
            
            # 환경
            "environment": getattr(record, 'environment', 'unknown'),
            "service": "hyperlocal-api",
            "version": getattr(record, 'app_version', 'unknown'),
        }
        
        # 예외 정보
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stacktrace": traceback.format_exception(*record.exc_info)
            }
        
        # 추가 컨텍스트 (민감 정보 마스킹)
        if hasattr(record, 'extra'):
            log_entry["context"] = self._mask_sensitive(record.extra)
        
        return json.dumps(log_entry, ensure_ascii=False, default=str)
    
    def _mask_sensitive(self, data: Any) -> Any:
        """민감 정보 마스킹"""
        if isinstance(data, dict):
            return {
                k: "***MASKED***" if k.lower() in self.SENSITIVE_FIELDS 
                   else self._mask_sensitive(v)
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [self._mask_sensitive(item) for item in data]
        return data


def setup_logging(
    level: str = "INFO",
    environment: str = "production"
) -> logging.Logger:
    """로깅 설정 초기화"""
    
    # 루트 로거 설정
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, level.upper()))
    
    # 핸들러 설정
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    
    # 기존 핸들러 제거 후 추가
    logger.handlers.clear()
    logger.addHandler(handler)
    
    # 외부 라이브러리 로그 레벨 조정
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    return logger


# FastAPI 미들웨어 - 요청 로깅
class RequestLoggingMiddleware:
    """모든 HTTP 요청/응답 로깅"""
    
    def __init__(self, app):
        self.app = app
        self.logger = logging.getLogger("hyperlocal.http")
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        
        # 요청 정보
        path = scope.get("path", "")
        method = scope.get("method", "")
        client_ip = self._get_client_ip(scope)
        
        # 응답 상태 코드 캡처
        status_code = None
        
        async def