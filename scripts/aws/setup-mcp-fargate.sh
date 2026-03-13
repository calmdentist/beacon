#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[setup-mcp] %s\n' "$*" >&2
}

die() {
  printf '[setup-mcp] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_cmd aws
require_cmd docker
require_cmd git

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

is_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

is_positive_integer() {
  [[ "${1:-}" =~ ^[1-9][0-9]*$ ]]
}

aws sts get-caller-identity >/dev/null 2>&1 || die "AWS CLI is not authenticated. Run 'aws sso login' or configure credentials first."

AWS_REGION="${AWS_REGION:-$(aws configure get region || true)}"
[[ -n "$AWS_REGION" ]] || die "AWS region is not set. Export AWS_REGION (for example: us-east-1)."

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"

APP_NAME="${APP_NAME:-beacon}"
ENV_NAME="${ENV_NAME:-prod}"

ECR_REPO="${ECR_REPO:-${APP_NAME}-mcp}"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE_URI="${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/amd64}"

ECS_CLUSTER="${ECS_CLUSTER:-${APP_NAME}-mcp-${ENV_NAME}}"
ECS_SERVICE="${ECS_SERVICE:-${APP_NAME}-mcp-${ENV_NAME}}"
TASK_FAMILY="${TASK_FAMILY:-${APP_NAME}-mcp-${ENV_NAME}}"

EXEC_ROLE_NAME="${EXEC_ROLE_NAME:-${APP_NAME}-ecs-task-exec-${ENV_NAME}}"
TASK_ROLE_NAME="${TASK_ROLE_NAME:-${APP_NAME}-mcp-task-${ENV_NAME}}"

CONTAINER_NAME="${CONTAINER_NAME:-mcp}"
CONTAINER_PORT="${CONTAINER_PORT:-4000}"
CPU="${CPU:-512}"
MEMORY="${MEMORY:-1024}"
DESIRED_COUNT="${DESIRED_COUNT:-1}"
ASSIGN_PUBLIC_IP="${ASSIGN_PUBLIC_IP:-ENABLED}" # ENABLED | DISABLED
HEALTH_CHECK_GRACE_PERIOD_SECONDS="${HEALTH_CHECK_GRACE_PERIOD_SECONDS:-60}"

BEACON_API_URL="${BEACON_API_URL:-}"
BEACON_API_TOKEN="${BEACON_API_TOKEN:-}"
BEACON_API_TOKEN_SECRET_NAME="${BEACON_API_TOKEN_SECRET_NAME:-${SECRET_NAME:-/${APP_NAME}/${ENV_NAME}/mcp/BEACON_API_TOKEN}}"
MCP_PUBLIC_BASE_URL="${MCP_PUBLIC_BASE_URL:-}"
MCP_AUTH_MODE="${MCP_AUTH_MODE:-oauth}"
MCP_REQUIRED_SCOPES="${MCP_REQUIRED_SCOPES:-mcp:tools}"
MCP_DEV_USER_ID="${MCP_DEV_USER_ID:-}"

MCP_OAUTH_ISSUER_URL="${MCP_OAUTH_ISSUER_URL:-}"
MCP_OAUTH_BRIDGE_URL="${MCP_OAUTH_BRIDGE_URL:-}"
MCP_OAUTH_SCOPES_SUPPORTED="${MCP_OAUTH_SCOPES_SUPPORTED:-$MCP_REQUIRED_SCOPES}"
MCP_OAUTH_ENABLE_DCR="${MCP_OAUTH_ENABLE_DCR:-}"
MCP_OAUTH_RESOURCE_NAME="${MCP_OAUTH_RESOURCE_NAME:-}"
MCP_OAUTH_COOKIE_DOMAIN="${MCP_OAUTH_COOKIE_DOMAIN:-}"
MCP_OAUTH_COOKIE_SECURE="${MCP_OAUTH_COOKIE_SECURE:-}"
MCP_OAUTH_COOKIE_NAME="${MCP_OAUTH_COOKIE_NAME:-}"
MCP_OAUTH_SESSION_TTL_SECONDS="${MCP_OAUTH_SESSION_TTL_SECONDS:-}"
MCP_OAUTH_AUTH_CODE_TTL_SECONDS="${MCP_OAUTH_AUTH_CODE_TTL_SECONDS:-}"
MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS="${MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS:-}"
MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS="${MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS:-}"
MCP_OAUTH_BRIDGE_SHARED_SECRET="${MCP_OAUTH_BRIDGE_SHARED_SECRET:-}"
MCP_OAUTH_SESSION_SECRET="${MCP_OAUTH_SESSION_SECRET:-}"
MCP_OAUTH_TOKEN_SECRET="${MCP_OAUTH_TOKEN_SECRET:-}"

MCP_OAUTH_BRIDGE_SHARED_SECRET_NAME="${MCP_OAUTH_BRIDGE_SHARED_SECRET_NAME:-/${APP_NAME}/${ENV_NAME}/mcp/MCP_OAUTH_BRIDGE_SHARED_SECRET}"
MCP_OAUTH_SESSION_SECRET_NAME="${MCP_OAUTH_SESSION_SECRET_NAME:-/${APP_NAME}/${ENV_NAME}/mcp/MCP_OAUTH_SESSION_SECRET}"
MCP_OAUTH_TOKEN_SECRET_NAME="${MCP_OAUTH_TOKEN_SECRET_NAME:-/${APP_NAME}/${ENV_NAME}/mcp/MCP_OAUTH_TOKEN_SECRET}"

ENABLE_ALB="${ENABLE_ALB:-true}" # true|false
MCP_PUBLIC_SCHEME="$(printf '%s' "$MCP_PUBLIC_BASE_URL" | sed -E 's#^([a-zA-Z]+)://.*#\1#')"
MCP_PUBLIC_HOST="$(printf '%s' "$MCP_PUBLIC_BASE_URL" | sed -E 's#^[a-zA-Z]+://([^/]+).*$#\1#')"
MCP_DOMAIN_NAME="${MCP_DOMAIN_NAME:-${MCP_PUBLIC_HOST%%:*}}"

ALB_NAME="${ALB_NAME:-${APP_NAME}-mcp-${ENV_NAME}}"
ALB_SCHEME="${ALB_SCHEME:-internet-facing}" # internet-facing | internal
ALB_SECURITY_GROUP_ID="${ALB_SECURITY_GROUP_ID:-}"
ALB_SECURITY_GROUP_NAME="${ALB_SECURITY_GROUP_NAME:-${APP_NAME}-mcp-${ENV_NAME}-alb-sg}"
TARGET_GROUP_NAME="${TARGET_GROUP_NAME:-${APP_NAME}-mcp-${ENV_NAME}-tg}"
HEALTH_CHECK_PATH="${HEALTH_CHECK_PATH:-/health}"
HTTPS_PORT="${HTTPS_PORT:-443}"
HTTP_PORT="${HTTP_PORT:-80}"
ACM_CERT_ARN="${ACM_CERT_ARN:-}"
REQUEST_ACM_CERT_IF_MISSING="${REQUEST_ACM_CERT_IF_MISSING:-true}" # true|false
ACM_CERT_DOMAIN="${ACM_CERT_DOMAIN:-$MCP_DOMAIN_NAME}"
ACM_CERT_SAN="${ACM_CERT_SAN:-}" # comma-separated SANs (optional)
ACM_REQUEST_IDEMPOTENCY_TOKEN="${ACM_REQUEST_IDEMPOTENCY_TOKEN:-}" # optional override (1-32 alnum)

CREATE_ROUTE53_RECORD="${CREATE_ROUTE53_RECORD:-false}" # true|false
ROUTE53_HOSTED_ZONE_ID="${ROUTE53_HOSTED_ZONE_ID:-}"

LOG_GROUP="${LOG_GROUP:-/ecs/${TASK_FAMILY}}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"

VPC_ID="${VPC_ID:-}"
SUBNET_IDS="${SUBNET_IDS:-}"          # comma-separated: subnet-abc,subnet-def
SECURITY_GROUP_ID="${SECURITY_GROUP_ID:-}"
SECURITY_GROUP_NAME="${SECURITY_GROUP_NAME:-${APP_NAME}-mcp-${ENV_NAME}-sg}"
ALLOWED_CIDR="${ALLOWED_CIDR:-0.0.0.0/0}"

[[ -n "$BEACON_API_URL" ]] || die "BEACON_API_URL is required."
[[ -n "$BEACON_API_TOKEN" ]] || die "BEACON_API_TOKEN is required."
[[ -n "$MCP_PUBLIC_BASE_URL" ]] || die "MCP_PUBLIC_BASE_URL is required."

case "$MCP_AUTH_MODE" in
  oauth|none) ;;
  *) die "MCP_AUTH_MODE must be oauth or none." ;;
esac

if [[ "$MCP_AUTH_MODE" == "oauth" ]]; then
  [[ -n "$MCP_OAUTH_BRIDGE_SHARED_SECRET" ]] || die "MCP_OAUTH_BRIDGE_SHARED_SECRET is required when MCP_AUTH_MODE=oauth."
  [[ -n "$MCP_OAUTH_SESSION_SECRET" ]] || die "MCP_OAUTH_SESSION_SECRET is required when MCP_AUTH_MODE=oauth."
  [[ -n "$MCP_OAUTH_TOKEN_SECRET" ]] || die "MCP_OAUTH_TOKEN_SECRET is required when MCP_AUTH_MODE=oauth."
  [[ ${#MCP_OAUTH_BRIDGE_SHARED_SECRET} -ge 32 ]] || die "MCP_OAUTH_BRIDGE_SHARED_SECRET must be at least 32 characters."
  [[ ${#MCP_OAUTH_SESSION_SECRET} -ge 32 ]] || die "MCP_OAUTH_SESSION_SECRET must be at least 32 characters."
  [[ ${#MCP_OAUTH_TOKEN_SECRET} -ge 32 ]] || die "MCP_OAUTH_TOKEN_SECRET must be at least 32 characters."
fi

if [[ -n "$MCP_OAUTH_ENABLE_DCR" ]]; then
  case "$MCP_OAUTH_ENABLE_DCR" in
    true|false) ;;
    *) die "MCP_OAUTH_ENABLE_DCR must be true or false when set." ;;
  esac
fi

if [[ -n "$MCP_OAUTH_COOKIE_SECURE" ]]; then
  case "$MCP_OAUTH_COOKIE_SECURE" in
    true|false) ;;
    *) die "MCP_OAUTH_COOKIE_SECURE must be true or false when set." ;;
  esac
fi

for ttl_var in \
  MCP_OAUTH_SESSION_TTL_SECONDS \
  MCP_OAUTH_AUTH_CODE_TTL_SECONDS \
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS \
  MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS; do
  ttl_value="${!ttl_var:-}"
  if [[ -n "$ttl_value" ]] && ! is_positive_integer "$ttl_value"; then
    die "${ttl_var} must be a positive integer when set."
  fi
done

TASK_ENV_NAMES=()
TASK_ENV_VALUES=()
TASK_SECRET_NAMES=()
TASK_SECRET_VALUES=()

add_task_env() {
  local key="$1"
  local value="$2"
  TASK_ENV_NAMES+=("$key")
  TASK_ENV_VALUES+=("$value")
}

add_task_env_if_set() {
  local key="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    add_task_env "$key" "$value"
  fi
}

add_task_secret() {
  local key="$1"
  local value_from="$2"
  TASK_SECRET_NAMES+=("$key")
  TASK_SECRET_VALUES+=("$value_from")
}

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  value="${value//$'\f'/\\f}"
  value="${value//$'\b'/\\b}"
  printf '%s' "$value"
}

add_task_env "NODE_ENV" "production"
add_task_env "MCP_PORT" "$CONTAINER_PORT"
add_task_env "MCP_PUBLIC_BASE_URL" "$MCP_PUBLIC_BASE_URL"
add_task_env "BEACON_API_URL" "$BEACON_API_URL"
add_task_env "MCP_AUTH_MODE" "$MCP_AUTH_MODE"
add_task_env "MCP_REQUIRED_SCOPES" "$MCP_REQUIRED_SCOPES"

add_task_env_if_set "MCP_DEV_USER_ID" "$MCP_DEV_USER_ID"
add_task_env_if_set "MCP_OAUTH_ISSUER_URL" "$MCP_OAUTH_ISSUER_URL"
add_task_env_if_set "MCP_OAUTH_BRIDGE_URL" "$MCP_OAUTH_BRIDGE_URL"
add_task_env_if_set "MCP_OAUTH_SCOPES_SUPPORTED" "$MCP_OAUTH_SCOPES_SUPPORTED"
add_task_env_if_set "MCP_OAUTH_ENABLE_DCR" "$MCP_OAUTH_ENABLE_DCR"
add_task_env_if_set "MCP_OAUTH_RESOURCE_NAME" "$MCP_OAUTH_RESOURCE_NAME"
add_task_env_if_set "MCP_OAUTH_COOKIE_DOMAIN" "$MCP_OAUTH_COOKIE_DOMAIN"
add_task_env_if_set "MCP_OAUTH_COOKIE_SECURE" "$MCP_OAUTH_COOKIE_SECURE"
add_task_env_if_set "MCP_OAUTH_COOKIE_NAME" "$MCP_OAUTH_COOKIE_NAME"
add_task_env_if_set "MCP_OAUTH_SESSION_TTL_SECONDS" "$MCP_OAUTH_SESSION_TTL_SECONDS"
add_task_env_if_set "MCP_OAUTH_AUTH_CODE_TTL_SECONDS" "$MCP_OAUTH_AUTH_CODE_TTL_SECONDS"
add_task_env_if_set "MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS" "$MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS"
add_task_env_if_set "MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS" "$MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS"

case "$ASSIGN_PUBLIC_IP" in
  ENABLED|DISABLED) ;;
  *) die "ASSIGN_PUBLIC_IP must be ENABLED or DISABLED." ;;
esac

case "$ALB_SCHEME" in
  internet-facing|internal) ;;
  *) die "ALB_SCHEME must be internet-facing or internal." ;;
esac

if [[ -n "$REQUEST_ACM_CERT_IF_MISSING" ]]; then
  case "$REQUEST_ACM_CERT_IF_MISSING" in
    true|false) ;;
    *) die "REQUEST_ACM_CERT_IF_MISSING must be true or false when set." ;;
  esac
fi

if is_true "$ENABLE_ALB"; then
  [[ ${#TARGET_GROUP_NAME} -le 32 ]] || die "TARGET_GROUP_NAME must be 32 characters or fewer."
  [[ -n "$MCP_DOMAIN_NAME" ]] || die "Could not derive MCP domain from MCP_PUBLIC_BASE_URL. Set MCP_DOMAIN_NAME."
  [[ "$MCP_PUBLIC_SCHEME" == "https" ]] || die "MCP_PUBLIC_BASE_URL must use https:// when ENABLE_ALB=true."
fi

case "$IMAGE_PLATFORM" in
  linux/amd64) RUNTIME_CPU_ARCH="X86_64" ;;
  linux/arm64) RUNTIME_CPU_ARCH="ARM64" ;;
  *) die "Unsupported IMAGE_PLATFORM '$IMAGE_PLATFORM'. Use linux/amd64 or linux/arm64." ;;
esac

if [[ -z "$VPC_ID" ]]; then
  VPC_ID="$(aws ec2 describe-vpcs \
    --region "$AWS_REGION" \
    --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' \
    --output text)"
  [[ "$VPC_ID" != "None" ]] || die "No default VPC found. Set VPC_ID explicitly."
fi

if [[ -z "$SUBNET_IDS" ]]; then
  SUBNET_IDS="$(aws ec2 describe-subnets \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
    --query 'Subnets[].SubnetId' \
    --output text | tr '\t' ',')"
  [[ -n "$SUBNET_IDS" ]] || die "No default subnets found in VPC $VPC_ID. Set SUBNET_IDS explicitly."
fi

ensure_ecr_repo() {
  local repo_name="$1"

  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo_name" >/dev/null 2>&1; then
    log "ECR repository exists: $repo_name"
    return
  fi

  log "Creating ECR repository: $repo_name"
  aws ecr create-repository \
    --region "$AWS_REGION" \
    --repository-name "$repo_name" \
    --image-scanning-configuration scanOnPush=true >/dev/null
}

ensure_iam_role() {
  local role_name="$1"
  local policy_file="$2"
  local role_arn

  role_arn="$(aws iam get-role --role-name "$role_name" --query 'Role.Arn' --output text 2>/dev/null || true)"
  if [[ -n "$role_arn" && "$role_arn" != "None" ]]; then
    echo "$role_arn"
    return
  fi

  log "Creating IAM role: $role_name"
  role_arn="$(aws iam create-role \
    --role-name "$role_name" \
    --assume-role-policy-document "file://$policy_file" \
    --query 'Role.Arn' \
    --output text)"
  echo "$role_arn"
}

ensure_cluster() {
  local cluster_name="$1"
  local status

  status="$(aws ecs describe-clusters \
    --region "$AWS_REGION" \
    --clusters "$cluster_name" \
    --query 'clusters[0].status' \
    --output text 2>/dev/null || true)"

  if [[ "$status" == "ACTIVE" || "$status" == "PROVISIONING" ]]; then
    log "ECS cluster exists: $cluster_name"
    return
  fi

  log "Creating ECS cluster: $cluster_name"
  aws ecs create-cluster --region "$AWS_REGION" --cluster-name "$cluster_name" >/dev/null
}

ensure_log_group() {
  local group_name="$1"

  if ! aws logs describe-log-groups \
    --region "$AWS_REGION" \
    --log-group-name-prefix "$group_name" \
    --query 'logGroups[?logGroupName==`'"$group_name"'`].logGroupName | [0]' \
    --output text | grep -q "$group_name"; then
    log "Creating CloudWatch log group: $group_name"
    aws logs create-log-group --region "$AWS_REGION" --log-group-name "$group_name"
  else
    log "CloudWatch log group exists: $group_name"
  fi

  aws logs put-retention-policy \
    --region "$AWS_REGION" \
    --log-group-name "$group_name" \
    --retention-in-days "$LOG_RETENTION_DAYS" >/dev/null
}

ensure_secret() {
  local secret_name="$1"
  local secret_value="$2"
  local arn

  arn="$(aws secretsmanager describe-secret \
    --region "$AWS_REGION" \
    --secret-id "$secret_name" \
    --query 'ARN' \
    --output text 2>/dev/null || true)"

  if [[ -n "$arn" && "$arn" != "None" ]]; then
    log "Updating secret value: $secret_name"
    aws secretsmanager put-secret-value \
      --region "$AWS_REGION" \
      --secret-id "$secret_name" \
      --secret-string "$secret_value" >/dev/null
    echo "$arn"
    return
  fi

  log "Creating secret: $secret_name"
  arn="$(aws secretsmanager create-secret \
    --region "$AWS_REGION" \
    --name "$secret_name" \
    --secret-string "$secret_value" \
    --query 'ARN' \
    --output text)"
  echo "$arn"
}

ensure_exec_role_secret_access() {
  local role_name="$1"
  shift
  local secret_names=("$@")

  [[ ${#secret_names[@]} -gt 0 ]] || die "ensure_exec_role_secret_access requires at least one secret name."

  local policy_name="${APP_NAME}-ecs-exec-secret-access-${ENV_NAME}"
  local policy_file
  policy_file="$(mktemp)"
  local secret_arn_patterns=()
  local secret_name
  for secret_name in "${secret_names[@]}"; do
    secret_arn_patterns+=("\"$(json_escape "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${secret_name}*")\"")
  done

  cat >"$policy_file" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowGetBeaconApiToken",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [$(IFS=,; printf '%s' "${secret_arn_patterns[*]}")]
    },
    {
      "Sid": "AllowDecryptSecretsManager",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.${AWS_REGION}.amazonaws.com"
        }
      }
    }
  ]
}
JSON

  aws iam put-role-policy \
    --role-name "$role_name" \
    --policy-name "$policy_name" \
    --policy-document "file://$policy_file" >/dev/null

  rm -f "$policy_file"
}

ensure_task_security_group() {
  local group_id="$SECURITY_GROUP_ID"

  if [[ -n "$group_id" ]]; then
    echo "$group_id"
    return
  fi

  group_id="$(aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)"

  if [[ "$group_id" == "None" ]]; then
    log "Creating ECS task security group: $SECURITY_GROUP_NAME"
    group_id="$(aws ec2 create-security-group \
      --region "$AWS_REGION" \
      --group-name "$SECURITY_GROUP_NAME" \
      --description "Security group for ${APP_NAME} MCP tasks (${ENV_NAME})" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' \
      --output text)"
  else
    log "ECS task security group exists: $SECURITY_GROUP_NAME ($group_id)"
  fi

  echo "$group_id"
}

allow_public_ingress_to_task_sg() {
  local task_group_id="$1"

  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$task_group_id" \
    --protocol tcp \
    --port "$CONTAINER_PORT" \
    --cidr "$ALLOWED_CIDR" >/dev/null 2>&1 || true
}

allow_alb_ingress_to_task_sg() {
  local task_group_id="$1"
  local alb_group_id="$2"

  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$task_group_id" \
    --protocol tcp \
    --port "$CONTAINER_PORT" \
    --source-group "$alb_group_id" >/dev/null 2>&1 || true
}

ensure_alb_security_group() {
  local group_id="$ALB_SECURITY_GROUP_ID"

  if [[ -n "$group_id" ]]; then
    echo "$group_id"
    return
  fi

  group_id="$(aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$ALB_SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)"

  if [[ "$group_id" == "None" ]]; then
    log "Creating ALB security group: $ALB_SECURITY_GROUP_NAME"
    group_id="$(aws ec2 create-security-group \
      --region "$AWS_REGION" \
      --group-name "$ALB_SECURITY_GROUP_NAME" \
      --description "Security group for ${APP_NAME} MCP ALB (${ENV_NAME})" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' \
      --output text)"
  else
    log "ALB security group exists: $ALB_SECURITY_GROUP_NAME ($group_id)"
  fi

  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$HTTP_PORT" \
    --cidr "$ALLOWED_CIDR" >/dev/null 2>&1 || true

  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$HTTPS_PORT" \
    --cidr "$ALLOWED_CIDR" >/dev/null 2>&1 || true

  echo "$group_id"
}

find_matching_acm_certificate_arn() {
  local cert_status="$1"
  local wildcard_domain=""
  local cert_arn=""

  if [[ "$MCP_DOMAIN_NAME" == *.* ]]; then
    wildcard_domain="*.${MCP_DOMAIN_NAME#*.}"
  fi

  if [[ -n "$wildcard_domain" ]]; then
    cert_arn="$(aws acm list-certificates \
      --region "$AWS_REGION" \
      --certificate-statuses "$cert_status" \
      --query "CertificateSummaryList[?DomainName==\`$MCP_DOMAIN_NAME\` || DomainName==\`$wildcard_domain\`].CertificateArn | [0]" \
      --output text 2>/dev/null || true)"
  else
    cert_arn="$(aws acm list-certificates \
      --region "$AWS_REGION" \
      --certificate-statuses "$cert_status" \
      --query "CertificateSummaryList[?DomainName==\`$MCP_DOMAIN_NAME\`].CertificateArn | [0]" \
      --output text 2>/dev/null || true)"
  fi

  if [[ -n "$cert_arn" && "$cert_arn" != "None" ]]; then
    echo "$cert_arn"
  fi
}

print_acm_dns_validation_records() {
  local cert_arn="$1"
  local lines=""
  local attempt

  for attempt in {1..8}; do
    lines="$(aws acm describe-certificate \
      --region "$AWS_REGION" \
      --certificate-arn "$cert_arn" \
      --query 'Certificate.DomainValidationOptions[].ResourceRecord.[Name,Type,Value]' \
      --output text 2>/dev/null || true)"

    if [[ -n "$lines" && "$lines" != "None" ]]; then
      break
    fi

    sleep 2
  done

  if [[ -z "$lines" || "$lines" == "None" ]]; then
    log "ACM validation records are not available yet."
    log "Check certificate details with:"
    log "  aws acm describe-certificate --region $AWS_REGION --certificate-arn $cert_arn"
    return
  fi

  log "Add these DNS records to validate the ACM certificate:"
  while IFS=$'\t' read -r record_name record_type record_value; do
    [[ -n "$record_name" ]] || continue
    log "  Name:  $record_name"
    log "  Type:  $record_type"
    log "  Value: $record_value"
  done <<< "$lines"
}

request_acm_certificate() {
  local request_domain="$1"
  local request_token
  if [[ -n "$ACM_REQUEST_IDEMPOTENCY_TOKEN" ]]; then
    request_token="$(printf '%s' "$ACM_REQUEST_IDEMPOTENCY_TOKEN" | tr -cd 'a-zA-Z0-9' | cut -c1-32)"
  else
    request_token="$(printf 'mcp%s%s' "$(date +%s)" "$RANDOM" | tr -cd 'a-zA-Z0-9' | cut -c1-32)"
  fi
  [[ -n "$request_token" ]] || request_token="mcp$(date +%s)"

  local args=(
    aws acm request-certificate
    --region "$AWS_REGION"
    --domain-name "$request_domain"
    --validation-method DNS
    --idempotency-token "$request_token"
  )

  if [[ -n "$ACM_CERT_SAN" ]]; then
    # shellcheck disable=SC2206
    local sans=( ${ACM_CERT_SAN//,/ } )
    args+=(--subject-alternative-names "${sans[@]}")
  fi

  "${args[@]}" --query 'CertificateArn' --output text
}

resolve_acm_certificate_arn() {
  if [[ -n "$ACM_CERT_ARN" ]]; then
    echo "$ACM_CERT_ARN"
    return
  fi

  local wildcard_domain=""
  if [[ "$MCP_DOMAIN_NAME" == *.* ]]; then
    wildcard_domain="*.${MCP_DOMAIN_NAME#*.}"
  fi

  local issued_arn
  issued_arn="$(find_matching_acm_certificate_arn "ISSUED")"
  if [[ -n "$issued_arn" ]]; then
    echo "$issued_arn"
    return
  fi

  local pending_arn
  pending_arn="$(find_matching_acm_certificate_arn "PENDING_VALIDATION")"

  if [[ -z "$pending_arn" ]] && is_true "$REQUEST_ACM_CERT_IF_MISSING"; then
    [[ -n "$ACM_CERT_DOMAIN" ]] || die "ACM_CERT_DOMAIN is empty. Set ACM_CERT_DOMAIN or MCP_DOMAIN_NAME."
    log "No ISSUED ACM cert found. Requesting a new DNS-validated ACM certificate for: $ACM_CERT_DOMAIN"
    pending_arn="$(request_acm_certificate "$ACM_CERT_DOMAIN")"
    log "Requested ACM certificate ARN: $pending_arn"
  fi

  if [[ -n "$pending_arn" && "$pending_arn" != "None" ]]; then
    print_acm_dns_validation_records "$pending_arn"
    die "ACM certificate is pending validation. Add DNS records, wait until ISSUED, then rerun this script."
  fi

  die "No ISSUED ACM cert found for $MCP_DOMAIN_NAME (or $wildcard_domain) in $AWS_REGION. Set ACM_CERT_ARN explicitly, or keep REQUEST_ACM_CERT_IF_MISSING=true to auto-request one."
}

ensure_load_balancer() {
  local alb_group_id="$1"
  local alb_arn

  alb_arn="$(aws elbv2 describe-load-balancers \
    --region "$AWS_REGION" \
    --names "$ALB_NAME" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || true)"

  if [[ -n "$alb_arn" && "$alb_arn" != "None" ]]; then
    log "ALB exists: $ALB_NAME"
    aws elbv2 set-security-groups \
      --region "$AWS_REGION" \
      --load-balancer-arn "$alb_arn" \
      --security-groups "$alb_group_id" >/dev/null
    echo "$alb_arn"
    return
  fi

  log "Creating ALB: $ALB_NAME"
  alb_arn="$(aws elbv2 create-load-balancer \
    --region "$AWS_REGION" \
    --name "$ALB_NAME" \
    --type application \
    --scheme "$ALB_SCHEME" \
    --ip-address-type ipv4 \
    --security-groups "$alb_group_id" \
    --subnets ${SUBNET_IDS//,/ } \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)"

  echo "$alb_arn"
}

ensure_target_group() {
  local target_group_arn

  target_group_arn="$(aws elbv2 describe-target-groups \
    --region "$AWS_REGION" \
    --names "$TARGET_GROUP_NAME" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || true)"

  if [[ -n "$target_group_arn" && "$target_group_arn" != "None" ]]; then
    log "Target group exists: $TARGET_GROUP_NAME"
    echo "$target_group_arn"
    return
  fi

  log "Creating target group: $TARGET_GROUP_NAME"
  target_group_arn="$(aws elbv2 create-target-group \
    --region "$AWS_REGION" \
    --name "$TARGET_GROUP_NAME" \
    --protocol HTTP \
    --port "$CONTAINER_PORT" \
    --target-type ip \
    --vpc-id "$VPC_ID" \
    --health-check-protocol HTTP \
    --health-check-path "$HEALTH_CHECK_PATH" \
    --matcher HttpCode=200-399 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)"

  echo "$target_group_arn"
}

ensure_https_listener() {
  local alb_arn="$1"
  local cert_arn="$2"
  local target_group_arn="$3"
  local listener_arn

  listener_arn="$(aws elbv2 describe-listeners \
    --region "$AWS_REGION" \
    --load-balancer-arn "$alb_arn" \
    --query "Listeners[?Port==\`$HTTPS_PORT\`].ListenerArn | [0]" \
    --output text 2>/dev/null || true)"

  if [[ -n "$listener_arn" && "$listener_arn" != "None" ]]; then
    log "HTTPS listener exists on port $HTTPS_PORT. Updating certificate/default action."
    aws elbv2 modify-listener \
      --region "$AWS_REGION" \
      --listener-arn "$listener_arn" \
      --certificates "CertificateArn=$cert_arn" \
      --default-actions "Type=forward,TargetGroupArn=$target_group_arn" >/dev/null
    echo "$listener_arn"
    return
  fi

  log "Creating HTTPS listener on port $HTTPS_PORT"
  listener_arn="$(aws elbv2 create-listener \
    --region "$AWS_REGION" \
    --load-balancer-arn "$alb_arn" \
    --protocol HTTPS \
    --port "$HTTPS_PORT" \
    --certificates "CertificateArn=$cert_arn" \
    --default-actions "Type=forward,TargetGroupArn=$target_group_arn" \
    --query 'Listeners[0].ListenerArn' \
    --output text)"

  echo "$listener_arn"
}

ensure_http_redirect_listener() {
  local alb_arn="$1"
  local listener_arn

  listener_arn="$(aws elbv2 describe-listeners \
    --region "$AWS_REGION" \
    --load-balancer-arn "$alb_arn" \
    --query "Listeners[?Port==\`$HTTP_PORT\`].ListenerArn | [0]" \
    --output text 2>/dev/null || true)"

  if [[ -n "$listener_arn" && "$listener_arn" != "None" ]]; then
    log "HTTP listener exists on port $HTTP_PORT"
    return
  fi

  log "Creating HTTP listener on port $HTTP_PORT with redirect to HTTPS"
  aws elbv2 create-listener \
    --region "$AWS_REGION" \
    --load-balancer-arn "$alb_arn" \
    --protocol HTTP \
    --port "$HTTP_PORT" \
    --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=$HTTPS_PORT,StatusCode=HTTP_301}" >/dev/null
}

upsert_route53_alias_record() {
  local hosted_zone_id="$1"
  local record_name="$2"
  local alb_dns_name="$3"
  local alb_zone_id="$4"
  local change_file
  change_file="$(mktemp)"

  cat >"$change_file" <<JSON
{
  "Comment": "Alias for ${record_name}",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${record_name}",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${alb_zone_id}",
          "DNSName": "dualstack.${alb_dns_name}",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
JSON

  aws route53 change-resource-record-sets \
    --region "$AWS_REGION" \
    --hosted-zone-id "$hosted_zone_id" \
    --change-batch "file://$change_file" >/dev/null

  rm -f "$change_file"
}

write_task_definition_with_jq() {
  local output_file="$1"
  local env_json='[]'
  local secrets_json='[]'
  local i

  for ((i = 0; i < ${#TASK_ENV_NAMES[@]}; i++)); do
    env_json="$(jq -cn \
      --argjson arr "$env_json" \
      --arg name "${TASK_ENV_NAMES[$i]}" \
      --arg value "${TASK_ENV_VALUES[$i]}" \
      '$arr + [{name: $name, value: $value}]')"
  done

  for ((i = 0; i < ${#TASK_SECRET_NAMES[@]}; i++)); do
    secrets_json="$(jq -cn \
      --argjson arr "$secrets_json" \
      --arg name "${TASK_SECRET_NAMES[$i]}" \
      --arg valueFrom "${TASK_SECRET_VALUES[$i]}" \
      '$arr + [{name: $name, valueFrom: $valueFrom}]')"
  done

  jq -n \
    --arg family "$TASK_FAMILY" \
    --arg runtimeCpuArch "$RUNTIME_CPU_ARCH" \
    --arg cpu "$CPU" \
    --arg memory "$MEMORY" \
    --arg executionRoleArn "$EXEC_ROLE_ARN" \
    --arg taskRoleArn "$TASK_ROLE_ARN" \
    --arg containerName "$CONTAINER_NAME" \
    --arg image "$IMAGE_URI" \
    --arg containerPort "$CONTAINER_PORT" \
    --arg logGroup "$LOG_GROUP" \
    --arg awsRegion "$AWS_REGION" \
    --argjson environment "$env_json" \
    --argjson secrets "$secrets_json" \
    '{
      family: $family,
      networkMode: "awsvpc",
      runtimePlatform: {
        cpuArchitecture: $runtimeCpuArch,
        operatingSystemFamily: "LINUX"
      },
      requiresCompatibilities: ["FARGATE"],
      cpu: $cpu,
      memory: $memory,
      executionRoleArn: $executionRoleArn,
      taskRoleArn: $taskRoleArn,
      containerDefinitions: [
        {
          name: $containerName,
          image: $image,
          essential: true,
          portMappings: [
            {
              containerPort: ($containerPort | tonumber),
              hostPort: ($containerPort | tonumber),
              protocol: "tcp"
            }
          ],
          environment: $environment,
          secrets: $secrets,
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": $logGroup,
              "awslogs-region": $awsRegion,
              "awslogs-stream-prefix": $containerName
            }
          }
        }
      ]
    }' >"$output_file"
}

write_task_definition_with_printf() {
  local output_file="$1"
  local env_count="${#TASK_ENV_NAMES[@]}"
  local secret_count="${#TASK_SECRET_NAMES[@]}"
  local i

  {
    printf '{\n'
    printf '  "family": "%s",\n' "$(json_escape "$TASK_FAMILY")"
    printf '  "networkMode": "awsvpc",\n'
    printf '  "runtimePlatform": {\n'
    printf '    "cpuArchitecture": "%s",\n' "$(json_escape "$RUNTIME_CPU_ARCH")"
    printf '    "operatingSystemFamily": "LINUX"\n'
    printf '  },\n'
    printf '  "requiresCompatibilities": ["FARGATE"],\n'
    printf '  "cpu": "%s",\n' "$(json_escape "$CPU")"
    printf '  "memory": "%s",\n' "$(json_escape "$MEMORY")"
    printf '  "executionRoleArn": "%s",\n' "$(json_escape "$EXEC_ROLE_ARN")"
    printf '  "taskRoleArn": "%s",\n' "$(json_escape "$TASK_ROLE_ARN")"
    printf '  "containerDefinitions": [\n'
    printf '    {\n'
    printf '      "name": "%s",\n' "$(json_escape "$CONTAINER_NAME")"
    printf '      "image": "%s",\n' "$(json_escape "$IMAGE_URI")"
    printf '      "essential": true,\n'
    printf '      "portMappings": [\n'
    printf '        {\n'
    printf '          "containerPort": %s,\n' "$CONTAINER_PORT"
    printf '          "hostPort": %s,\n' "$CONTAINER_PORT"
    printf '          "protocol": "tcp"\n'
    printf '        }\n'
    printf '      ],\n'
    printf '      "environment": [\n'
    for ((i = 0; i < env_count; i++)); do
      printf '        { "name": "%s", "value": "%s" }' \
        "$(json_escape "${TASK_ENV_NAMES[$i]}")" \
        "$(json_escape "${TASK_ENV_VALUES[$i]}")"
      if ((i < env_count - 1)); then
        printf ','
      fi
      printf '\n'
    done
    printf '      ],\n'
    printf '      "secrets": [\n'
    for ((i = 0; i < secret_count; i++)); do
      printf '        { "name": "%s", "valueFrom": "%s" }' \
        "$(json_escape "${TASK_SECRET_NAMES[$i]}")" \
        "$(json_escape "${TASK_SECRET_VALUES[$i]}")"
      if ((i < secret_count - 1)); then
        printf ','
      fi
      printf '\n'
    done
    printf '      ],\n'
    printf '      "logConfiguration": {\n'
    printf '        "logDriver": "awslogs",\n'
    printf '        "options": {\n'
    printf '          "awslogs-group": "%s",\n' "$(json_escape "$LOG_GROUP")"
    printf '          "awslogs-region": "%s",\n' "$(json_escape "$AWS_REGION")"
    printf '          "awslogs-stream-prefix": "%s"\n' "$(json_escape "$CONTAINER_NAME")"
    printf '        }\n'
    printf '      }\n'
    printf '    }\n'
    printf '  ]\n'
    printf '}\n'
  } >"$output_file"
}

write_task_definition_file() {
  local output_file="$1"

  if command -v jq >/dev/null 2>&1; then
    write_task_definition_with_jq "$output_file"
    return
  fi

  log "jq not found; using shell fallback for task-definition JSON generation."
  write_task_definition_with_printf "$output_file"
}

TASK_TRUST_FILE="$(mktemp)"
TASK_DEF_FILE="$(mktemp)"
cleanup() {
  rm -f "$TASK_TRUST_FILE" "$TASK_DEF_FILE"
}
trap cleanup EXIT

cat >"$TASK_TRUST_FILE" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

log "Using region: $AWS_REGION"
log "Using AWS account: $AWS_ACCOUNT_ID"
log "Using VPC: $VPC_ID"
log "Using subnets: $SUBNET_IDS"

ensure_ecr_repo "$ECR_REPO"

log "Authenticating Docker to ECR"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null

if docker buildx version >/dev/null 2>&1; then
  log "Building and pushing MCP image via buildx: $IMAGE_URI ($IMAGE_PLATFORM)"
  docker buildx build \
    --platform "$IMAGE_PLATFORM" \
    -f apps/mcp/Dockerfile \
    -t "$IMAGE_URI" \
    --push \
    .
else
  log "Building MCP image: $IMAGE_URI ($IMAGE_PLATFORM)"
  docker build --platform "$IMAGE_PLATFORM" -f apps/mcp/Dockerfile -t "$IMAGE_URI" .

  log "Pushing image to ECR"
  docker push "$IMAGE_URI" >/dev/null
fi

EXEC_ROLE_ARN="$(ensure_iam_role "$EXEC_ROLE_NAME" "$TASK_TRUST_FILE")"
TASK_ROLE_ARN="$(ensure_iam_role "$TASK_ROLE_NAME" "$TASK_TRUST_FILE")"

aws iam attach-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" >/dev/null

# IAM role propagation can lag briefly in fresh accounts.
sleep 10

BEACON_API_TOKEN_SECRET_ARN="$(ensure_secret "$BEACON_API_TOKEN_SECRET_NAME" "$BEACON_API_TOKEN")"
add_task_secret "BEACON_API_TOKEN" "$BEACON_API_TOKEN_SECRET_ARN"

SECRET_NAMES_FOR_EXEC_ROLE=("$BEACON_API_TOKEN_SECRET_NAME")

if [[ "$MCP_AUTH_MODE" == "oauth" ]]; then
  MCP_OAUTH_BRIDGE_SHARED_SECRET_ARN="$(ensure_secret "$MCP_OAUTH_BRIDGE_SHARED_SECRET_NAME" "$MCP_OAUTH_BRIDGE_SHARED_SECRET")"
  MCP_OAUTH_SESSION_SECRET_ARN="$(ensure_secret "$MCP_OAUTH_SESSION_SECRET_NAME" "$MCP_OAUTH_SESSION_SECRET")"
  MCP_OAUTH_TOKEN_SECRET_ARN="$(ensure_secret "$MCP_OAUTH_TOKEN_SECRET_NAME" "$MCP_OAUTH_TOKEN_SECRET")"

  add_task_secret "MCP_OAUTH_BRIDGE_SHARED_SECRET" "$MCP_OAUTH_BRIDGE_SHARED_SECRET_ARN"
  add_task_secret "MCP_OAUTH_SESSION_SECRET" "$MCP_OAUTH_SESSION_SECRET_ARN"
  add_task_secret "MCP_OAUTH_TOKEN_SECRET" "$MCP_OAUTH_TOKEN_SECRET_ARN"

  SECRET_NAMES_FOR_EXEC_ROLE+=(
    "$MCP_OAUTH_BRIDGE_SHARED_SECRET_NAME"
    "$MCP_OAUTH_SESSION_SECRET_NAME"
    "$MCP_OAUTH_TOKEN_SECRET_NAME"
  )
fi

log "Ensuring execution role can read secrets for task startup."
ensure_exec_role_secret_access "$EXEC_ROLE_NAME" "${SECRET_NAMES_FOR_EXEC_ROLE[@]}"

# Policy propagation can lag briefly in fresh accounts.
sleep 10

ensure_log_group "$LOG_GROUP"
ensure_cluster "$ECS_CLUSTER"

TASK_SECURITY_GROUP_ID="$(ensure_task_security_group)"
SECURITY_GROUP_ID="$TASK_SECURITY_GROUP_ID"

ALB_ARN=""
ALB_DNS_NAME=""
ALB_ZONE_ID=""
TARGET_GROUP_ARN=""

SERVICE_LB_ARGS=()

if is_true "$ENABLE_ALB"; then
  ALB_SECURITY_GROUP_ID="$(ensure_alb_security_group)"
  allow_alb_ingress_to_task_sg "$TASK_SECURITY_GROUP_ID" "$ALB_SECURITY_GROUP_ID"

  ACM_CERT_ARN="$(resolve_acm_certificate_arn)"
  ALB_ARN="$(ensure_load_balancer "$ALB_SECURITY_GROUP_ID")"
  TARGET_GROUP_ARN="$(ensure_target_group)"
  ensure_https_listener "$ALB_ARN" "$ACM_CERT_ARN" "$TARGET_GROUP_ARN" >/dev/null
  ensure_http_redirect_listener "$ALB_ARN"

  SERVICE_LB_ARGS=(
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$CONTAINER_NAME,containerPort=$CONTAINER_PORT"
    --health-check-grace-period-seconds "$HEALTH_CHECK_GRACE_PERIOD_SECONDS"
  )
else
  if [[ "$ASSIGN_PUBLIC_IP" == "ENABLED" ]]; then
    allow_public_ingress_to_task_sg "$TASK_SECURITY_GROUP_ID"
  fi
fi

write_task_definition_file "$TASK_DEF_FILE"

log "Registering task definition: $TASK_FAMILY"
TASK_DEF_ARN="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://$TASK_DEF_FILE" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

NETWORK_CONFIGURATION="awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SECURITY_GROUP_ID}],assignPublicIp=${ASSIGN_PUBLIC_IP}}"
SERVICE_STATUS="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].status' \
  --output text 2>/dev/null || true)"

if [[ -z "$SERVICE_STATUS" || "$SERVICE_STATUS" == "None" || "$SERVICE_STATUS" == "INACTIVE" ]]; then
  log "Creating ECS service: $ECS_SERVICE"
  aws ecs create-service \
    --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER" \
    --service-name "$ECS_SERVICE" \
    --task-definition "$TASK_DEF_ARN" \
    --desired-count "$DESIRED_COUNT" \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "$NETWORK_CONFIGURATION" \
    "${SERVICE_LB_ARGS[@]}" >/dev/null
else
  log "Updating ECS service: $ECS_SERVICE"
  aws ecs update-service \
    --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$TASK_DEF_ARN" \
    --desired-count "$DESIRED_COUNT" \
    "${SERVICE_LB_ARGS[@]}" \
    --force-new-deployment >/dev/null
fi

log "Waiting for ECS service to stabilize..."
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"

log "Deployment complete."
log "Cluster: $ECS_CLUSTER"
log "Service: $ECS_SERVICE"
log "Task definition: $TASK_DEF_ARN"
log "Image: $IMAGE_URI"

if is_true "$ENABLE_ALB"; then
  ALB_DNS_NAME="$(aws elbv2 describe-load-balancers \
    --region "$AWS_REGION" \
    --load-balancer-arns "$ALB_ARN" \
    --query 'LoadBalancers[0].DNSName' \
    --output text)"
  ALB_ZONE_ID="$(aws elbv2 describe-load-balancers \
    --region "$AWS_REGION" \
    --load-balancer-arns "$ALB_ARN" \
    --query 'LoadBalancers[0].CanonicalHostedZoneId' \
    --output text)"

  log "ALB: $ALB_NAME"
  log "ALB DNS: $ALB_DNS_NAME"
  log "MCP URL: $MCP_PUBLIC_BASE_URL"
  log "MCP health URL: ${MCP_PUBLIC_BASE_URL%/}/health"

  if is_true "$CREATE_ROUTE53_RECORD"; then
    [[ -n "$ROUTE53_HOSTED_ZONE_ID" ]] || die "ROUTE53_HOSTED_ZONE_ID is required when CREATE_ROUTE53_RECORD=true."
    log "Upserting Route53 alias record: $MCP_DOMAIN_NAME -> $ALB_DNS_NAME"
    upsert_route53_alias_record "$ROUTE53_HOSTED_ZONE_ID" "$MCP_DOMAIN_NAME" "$ALB_DNS_NAME" "$ALB_ZONE_ID"
    log "Route53 record updated for $MCP_DOMAIN_NAME"
  else
    log "Create or update DNS record at your DNS provider:"
    log "  Host: $MCP_DOMAIN_NAME"
    log "  Type: CNAME"
    log "  Value: $ALB_DNS_NAME"
  fi
elif [[ "$ASSIGN_PUBLIC_IP" == "ENABLED" ]]; then
  TASK_ARN="$(aws ecs list-tasks \
    --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER" \
    --service-name "$ECS_SERVICE" \
    --desired-status RUNNING \
    --query 'taskArns[0]' \
    --output text)"

  if [[ -n "$TASK_ARN" && "$TASK_ARN" != "None" ]]; then
    ENI_ID="$(aws ecs describe-tasks \
      --region "$AWS_REGION" \
      --cluster "$ECS_CLUSTER" \
      --tasks "$TASK_ARN" \
      --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value | [0]' \
      --output text)"

    if [[ -n "$ENI_ID" && "$ENI_ID" != "None" ]]; then
      PUBLIC_IP="$(aws ec2 describe-network-interfaces \
        --region "$AWS_REGION" \
        --network-interface-ids "$ENI_ID" \
        --query 'NetworkInterfaces[0].Association.PublicIp' \
        --output text)"
      if [[ -n "$PUBLIC_IP" && "$PUBLIC_IP" != "None" ]]; then
        log "MCP public health URL: http://${PUBLIC_IP}:${CONTAINER_PORT}/health"
      fi
    fi
  fi
fi
