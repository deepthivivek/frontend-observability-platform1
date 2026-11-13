/**
 * Enterprise Configuration & Environment Validator
 * Strictly validates enterprise environment variables, security secrets,
 * and PQC cryptographic seed lengths upon platform initialization.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load local environment variables if available
dotenv.config();

export const EnterpriseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for enterprise cryptographic compliance.')
    .default('neon_chasm_jwt_enterprise_master_secret_key_32chars'),
  PQC_LATTICE_SEED: z
    .string()
    .min(16, 'PQC_LATTICE_SEED must be at least 16 characters for ML-KEM/Kyber seed generation.')
    .default('pqc_ml_kem_1024_seed_key_64'),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(32, 'ENCRYPTION_MASTER_KEY must be at least 32 characters for AES-256-GCM / FHE.')
    .default('fhe_aes256_gcm_master_vault_key_32bytes'),
  MAX_WORKERS: z.coerce.number().int().positive().default(8),
});

export type EnterpriseConfig = z.infer<typeof EnterpriseEnvSchema>;

export function validateEnterpriseEnvironment(customEnv?: Record<string, string | undefined>): EnterpriseConfig {
  const envToValidate = customEnv || process.env;
  const result = EnterpriseEnvSchema.safeParse(envToValidate);

  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    console.error('================================================================================');
    console.error('[CRITICAL] ENTERPRISE ENVIRONMENT VALIDATION FAILED:');
    errorDetails.forEach((err) => {
      console.error(`  - ${err.field}: ${err.message}`);
    });
    console.error('================================================================================');

    if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
      throw new Error(`Enterprise environment validation failed: ${JSON.stringify(errorDetails)}`);
    }

    // In dev / test, fallback to schema parsed with defaults
    return EnterpriseEnvSchema.parse({});
  }

  return result.data;
}

export const enterpriseConfig = validateEnterpriseEnvironment();
