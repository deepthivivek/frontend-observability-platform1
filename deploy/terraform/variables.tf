variable "project_id" {
  description = "GCP Project ID hosting The Neon Chasm observability cluster"
  type        = string
}

variable "region" {
  description = "Primary GCP region for multi-AZ regional control plane and KMS ring"
  type        = string
  default     = "us-central1"
}

variable "node_zones" {
  description = "Explicit availability zones for multi-AZ worker nodes"
  type        = list(string)
  default     = ["us-central1-a", "us-central1-b", "us-central1-c"]
}

variable "cluster_name" {
  description = "GKE cluster identifier"
  type        = string
  default     = "neon-chasm-prod"
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace enforcing Restricted Pod Security Standard"
  type        = string
  default     = "neon-chasm-enterprise"
}

variable "kms_rotation_period" {
  description = "Automatic rotation period for KMS envelope keys (90 days default)"
  type        = string
  default     = "7776000s"
}

variable "min_nodes_per_zone" {
  description = "Minimum worker nodes per availability zone"
  type        = number
  default     = 1
}

variable "max_nodes_per_zone" {
  description = "Maximum worker nodes per availability zone"
  type        = number
  default     = 4
}

variable "machine_type" {
  description = "Compute Engine machine type for telemetry & swarm workloads"
  type        = string
  default     = "n2-standard-4"
}
