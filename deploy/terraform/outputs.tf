output "cluster_name" {
  description = "Provisioned multi-AZ GKE cluster name"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "Control plane HTTPS endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "kms_crypto_key_id" {
  description = "KMS key protecting Kubernetes etcd secrets and WAL snapshots"
  value       = google_kms_crypto_key.etcd_wal_key.id
}

output "workload_identity_gsa_email" {
  description = "GCP Service Account email bound via Workload Identity to the neon-chasm KSA"
  value       = google_service_account.neon_chasm_workload.email
}

output "kubernetes_namespace" {
  description = "Restricted PSS namespace for Helm release deployment"
  value       = kubernetes_namespace.neon_chasm.metadata[0].name
}
