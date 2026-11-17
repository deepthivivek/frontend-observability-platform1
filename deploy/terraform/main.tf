data "google_client_config" "current" {}

data "google_project" "project" {
  project_id = var.project_id
}

# ---------------------------------------------------------------------------
# Zero-Trust Envelope Encryption (KMS Key Ring + Auto-Rotating Crypto Key)
# ---------------------------------------------------------------------------
resource "google_kms_key_ring" "neon_chasm" {
  name     = "${var.cluster_name}-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "etcd_wal_key" {
  name            = "${var.cluster_name}-etcd-wal-key"
  key_ring        = google_kms_key_ring.neon_chasm.id
  rotation_period = var.kms_rotation_period
  purpose         = "ENCRYPT_DECRYPT"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  lifecycle {
    prevent_destroy = false
  }
}

resource "google_kms_crypto_key_iam_member" "gke_kms_encrypter" {
  crypto_key_id = google_kms_crypto_key.etcd_wal_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@container-engine-robot.iam.gserviceaccount.com"
}

# ---------------------------------------------------------------------------
# Isolated VPC & Subnet for Observability Ingestion Plane
# ---------------------------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.cluster_name}-subnet"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = "10.20.0.0/16"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods-range"
    ip_cidr_range = "10.30.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "10.40.0.0/20"
  }
}

# ---------------------------------------------------------------------------
# Multi-AZ GKE Regional Cluster with Workload Identity & Shielded Nodes
# ---------------------------------------------------------------------------
resource "google_container_cluster" "primary" {
  name                     = var.cluster_name
  location                 = var.region
  node_locations           = var.node_zones
  remove_default_node_pool = true
  initial_node_count       = 1
  network                  = google_compute_network.vpc.name
  subnetwork               = google_compute_subnetwork.subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods-range"
    services_secondary_range_name = "services-range"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  database_encryption {
    state    = "ENCRYPTED"
    key_name = google_kms_crypto_key.etcd_wal_key.id
  }

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  enable_shielded_nodes = true

  release_channel {
    channel = "REGULAR"
  }

  depends_on = [google_kms_crypto_key_iam_member.gke_kms_encrypter]
}

resource "google_container_node_pool" "primary_nodes" {
  name           = "${var.cluster_name}-multi-az-pool"
  cluster        = google_container_cluster.primary.id
  location       = var.region
  node_locations = var.node_zones

  autoscaling {
    min_node_count = var.min_nodes_per_zone
    max_node_count = var.max_nodes_per_zone
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 100
    disk_type    = "pd-balanced"

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      platform = "neon-chasm"
      tier     = "observability-core"
    }
  }
}

# ---------------------------------------------------------------------------
# Workload Identity IAM Binding (Zero Static Credentials in Pods)
# ---------------------------------------------------------------------------
resource "google_service_account" "neon_chasm_workload" {
  account_id   = "${var.cluster_name}-workload-sa"
  display_name = "The Neon Chasm Observability Workload Identity SA"
}

resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.neon_chasm_workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.kubernetes_namespace}/neon-chasm]"
}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.primary.endpoint}"
  token                  = data.google_client_config.current.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
}

resource "kubernetes_namespace" "neon_chasm" {
  metadata {
    name = var.kubernetes_namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

resource "kubernetes_service_account" "neon_chasm" {
  metadata {
    name      = "neon-chasm"
    namespace = kubernetes_namespace.neon_chasm.metadata[0].name
    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.neon_chasm_workload.email
    }
  }
  automount_service_account_token = false
}
