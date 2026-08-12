export interface VerificationCompletionChecks {
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  needsInsurance: boolean;
  needsBiz: boolean;
}

/** Only fully successful required checks qualify for the 90-day success window. */
export function isVerificationComplete(checks: VerificationCompletionChecks): boolean {
  return (
    checks.licenseVerified &&
    (!checks.needsInsurance || checks.insuranceVerified) &&
    (!checks.needsBiz || checks.bizVerified)
  );
}
