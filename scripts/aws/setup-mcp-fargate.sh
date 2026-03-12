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

BEACON_API_URL="${BEACON_API_URL:-}"
BEACON_API_TOKEN="${BEACON_API_TOKEN:-}"
SECRET_NAME="${SECRET_NAME:-/${APP_NAME}/${ENV_NAME}/mcp/BEACON_API_TOKEN}"
MCP_PUBLIC_BASE_URL="${MCP_PUBLIC_BASE_URL:-}"
MCP_AUTH_MODE="${MCP_AUTH_MODE:-oauth}"
MCP_REQUIRED_SCOPES="${MCP_REQUIRED_SCOPES:-mcp:tools}"
MCP_USER_ID_CLAIM="${MCP_USER_ID_CLAIM:-sub}"
MCP_DEV_USER_ID="${MCP_DEV_USER_ID:-}"

MCP_OAUTH_ISSUER_URL="${MCP_OAUTH_ISSUER_URL:-}"
MCP_OAUTH_AUTHORIZATION_ENDPOINT="${MCP_OAUTH_AUTHORIZATION_ENDPOINT:-}"
MCP_OAUTH_TOKEN_ENDPOINT="${MCP_OAUTH_TOKEN_ENDPOINT:-}"
MCP_OAUTH_REGISTRATION_ENDPOINT="${MCP_OAUTH_REGISTRATION_ENDPOINT:-}"
MCP_OAUTH_REVOCATION_ENDPOINT="${MCP_OAUTH_REVOCATION_ENDPOINT:-}"
MCP_OAUTH_INTROSPECTION_ENDPOINT="${MCP_OAUTH_INTROSPECTION_ENDPOINT:-}"
MCP_OAUTH_JWKS_URL="${MCP_OAUTH_JWKS_URL:-}"
MCP_OAUTH_AUDIENCE="${MCP_OAUTH_AUDIENCE:-}"
MCP_OAUTH_SCOPES_SUPPORTED="${MCP_OAUTH_SCOPES_SUPPORTED:-$MCP_REQUIRED_SCOPES}"

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
  [[ -n "$MCP_OAUTH_ISSUER_URL" ]] || die "MCP_OAUTH_ISSUER_URL is required when MCP_AUTH_MODE=oauth."
  [[ -n "$MCP_OAUTH_AUTHORIZATION_ENDPOINT" ]] || die "MCP_OAUTH_AUTHORIZATION_ENDPOINT is required when MCP_AUTH_MODE=oauth."
  [[ -n "$MCP_OAUTH_TOKEN_ENDPOINT" ]] || die "MCP_OAUTH_TOKEN_ENDPOINT is required when MCP_AUTH_MODE=oauth."
  [[ -n "$MCP_OAUTH_JWKS_URL" ]] || die "MCP_OAUTH_JWKS_URL is required when MCP_AUTH_MODE=oauth."
fi

MCP_OPTIONAL_ENV_LINES=""
append_mcp_optional_env() {
  local key="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    MCP_OPTIONAL_ENV_LINES+=$',\n        { "name": "'"$key"'", "value": "'"$value"'" }'
  fi
}

append_mcp_optional_env "MCP_DEV_USER_ID" "$MCP_DEV_USER_ID"
append_mcp_optional_env "MCP_OAUTH_REGISTRATION_ENDPOINT" "$MCP_OAUTH_REGISTRATION_ENDPOINT"
append_mcp_optional_env "MCP_OAUTH_REVOCATION_ENDPOINT" "$MCP_OAUTH_REVOCATION_ENDPOINT"
append_mcp_optional_env "MCP_OAUTH_INTROSPECTION_ENDPOINT" "$MCP_OAUTH_INTROSPECTION_ENDPOINT"
append_mcp_optional_env "MCP_OAUTH_AUDIENCE" "$MCP_OAUTH_AUDIENCE"

case "$ASSIGN_PUBLIC_IP" in
  ENABLED|DISABLED) ;;
  *) die "ASSIGN_PUBLIC_IP must be ENABLED or DISABLED." ;;
esac

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
  local secret_name="$2"

  local policy_name="${APP_NAME}-ecs-exec-secret-access-${ENV_NAME}"
  local policy_file
  policy_file="$(mktemp)"

  local secret_arn_pattern="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${secret_name}*"

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
      "Resource": "$secret_arn_pattern"
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

ensure_security_group() {
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
    log "Creating security group: $SECURITY_GROUP_NAME"
    group_id="$(aws ec2 create-security-group \
      --region "$AWS_REGION" \
      --group-name "$SECURITY_GROUP_NAME" \
      --description "Security group for ${APP_NAME} MCP (${ENV_NAME})" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' \
      --output text)"
  else
    log "Security group exists: $SECURITY_GROUP_NAME ($group_id)"
  fi

  if [[ "$ASSIGN_PUBLIC_IP" == "ENABLED" ]]; then
    aws ec2 authorize-security-group-ingress \
      --region "$AWS_REGION" \
      --group-id "$group_id" \
      --protocol tcp \
      --port "$CONTAINER_PORT" \
      --cidr "$ALLOWED_CIDR" >/dev/null 2>&1 || true
  fi

  echo "$group_id"
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

SECRET_ARN="$(ensure_secret "$SECRET_NAME" "$BEACON_API_TOKEN")"
log "Ensuring execution role can read secret: $SECRET_NAME"
ensure_exec_role_secret_access "$EXEC_ROLE_NAME" "$SECRET_NAME"

# Policy propagation can lag briefly in fresh accounts.
sleep 10

ensure_log_group "$LOG_GROUP"
ensure_cluster "$ECS_CLUSTER"

SECURITY_GROUP_ID="$(ensure_security_group)"

cat >"$TASK_DEF_FILE" <<JSON
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "runtimePlatform": {
    "cpuArchitecture": "$RUNTIME_CPU_ARCH",
    "operatingSystemFamily": "LINUX"
  },
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "$CPU",
  "memory": "$MEMORY",
  "executionRoleArn": "$EXEC_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "$CONTAINER_NAME",
      "image": "$IMAGE_URI",
      "essential": true,
      "portMappings": [
        {
          "containerPort": $CONTAINER_PORT,
          "hostPort": $CONTAINER_PORT,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "MCP_PORT", "value": "$CONTAINER_PORT" },
        { "name": "MCP_PUBLIC_BASE_URL", "value": "$MCP_PUBLIC_BASE_URL" },
        { "name": "BEACON_API_URL", "value": "$BEACON_API_URL" },
        { "name": "MCP_AUTH_MODE", "value": "$MCP_AUTH_MODE" },
        { "name": "MCP_REQUIRED_SCOPES", "value": "$MCP_REQUIRED_SCOPES" },
        { "name": "MCP_USER_ID_CLAIM", "value": "$MCP_USER_ID_CLAIM" },
        { "name": "MCP_OAUTH_ISSUER_URL", "value": "$MCP_OAUTH_ISSUER_URL" },
        { "name": "MCP_OAUTH_AUTHORIZATION_ENDPOINT", "value": "$MCP_OAUTH_AUTHORIZATION_ENDPOINT" },
        { "name": "MCP_OAUTH_TOKEN_ENDPOINT", "value": "$MCP_OAUTH_TOKEN_ENDPOINT" },
        { "name": "MCP_OAUTH_JWKS_URL", "value": "$MCP_OAUTH_JWKS_URL" },
        { "name": "MCP_OAUTH_SCOPES_SUPPORTED", "value": "$MCP_OAUTH_SCOPES_SUPPORTED" }$MCP_OPTIONAL_ENV_LINES
      ],
      "secrets": [
        { "name": "BEACON_API_TOKEN", "valueFrom": "$SECRET_ARN" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "$LOG_GROUP",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "$CONTAINER_NAME"
        }
      }
    }
  ]
}
JSON

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
    --network-configuration "$NETWORK_CONFIGURATION" >/dev/null
else
  log "Updating ECS service: $ECS_SERVICE"
  aws ecs update-service \
    --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$TASK_DEF_ARN" \
    --desired-count "$DESIRED_COUNT" >/dev/null
fi

log "Waiting for ECS service to stabilize..."
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"

log "Deployment complete."
log "Cluster: $ECS_CLUSTER"
log "Service: $ECS_SERVICE"
log "Task definition: $TASK_DEF_ARN"
log "Image: $IMAGE_URI"

if [[ "$ASSIGN_PUBLIC_IP" == "ENABLED" ]]; then
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
