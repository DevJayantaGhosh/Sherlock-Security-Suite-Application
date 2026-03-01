export const ACCESS_MESSAGES = {
  // Role-based restrictions
  ROLE_RESTRICTED_TITLE: "🔒 Access Restricted" as const,
  SECURITY_HEAD_MSG: "Only assigned Security-Head is authorized to run security scans but you can view this page" as const,
  RELEASE_ENGINEER_SIGN_MSG: "Only assigned Release-Engineer(s) can sign artifacts but you can view this page" as const,
  RELEASE_ENGINEER_RELEASE_MSG: "Only assigned Release-Engineer(s) can make release but you can view this page" as const,

  // Status-based blocks
  SIGNING_RESTRICTED_TITLE: "Signing Restricted" as const,
  RELEASE_RESTRICTED_TITLE: "Release Restricted" as const,
  VERIFY_RESTRICTED_TITLE: "Signature Verification Restricted" as const,
  SIGNING_NEEDS_APPROVAL: "Product must be Approved by assigned Security-Head first!" as const,
  RELEASE_NEEDS_SIGNING: "Product must be Signed by assigned Release Engineer(s) first!" as const,
  VERIFY_NEEDS_RELEASE: "Product must be Released before signatures can be verified." as const,

} as const;
