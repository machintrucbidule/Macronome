// ErrorCode enum mirroring spec/api/00-conventions.md. The server returns these
// stable `string_snake` codes; the web client maps them to user-facing messages.
// Domain codes for later milestones are listed here so the mirror stays single-source.
export enum ErrorCode {
  // auth & session
  InvalidCredentials = 'invalid_credentials',
  LockedOut = 'locked_out',
  Unauthorized = 'unauthorized',
  CsrfInvalid = 'csrf_invalid',
  SetupAlreadyCompleted = 'setup_already_completed',

  // generic
  ValidationError = 'validation_error',
  NotFound = 'not_found',
  Forbidden = 'forbidden',
  Conflict = 'conflict',
  Internal = 'internal_error',

  // domain conflicts (introduced in later milestones)
  GrossBelowTare = 'gross_below_tare',
  LeftoverExceedsServed = 'leftover_exceeds_served',
  SummaryDayReadonly = 'summary_day_readonly',
  CaloriesNotEditable = 'calories_not_editable',
  WeighInDateOccupied = 'weigh_in_date_occupied',
  TargetDateOccupied = 'target_date_occupied',
  WouldCreateCycle = 'would_create_cycle',
  PantryDuplicate = 'pantry_duplicate',
  CopySourceEmpty = 'copy_source_empty',

  // admin user management (B-192) + token links (B-193/B-194)
  LastAdmin = 'last_admin',
  OwnAccount = 'own_account',
  TokenInvalid = 'token_invalid',
  UsernameTaken = 'username_taken',

  // data export / import (IMP-1)
  ImportInvalidFormat = 'import_invalid_format',
  ImportUnsupportedVersion = 'import_unsupported_version',

  // macro-label parser (PM-1/B-114)
  ReconstitutedLabel = 'reconstituted_label',
  NoReference = 'no_reference',
  Unparseable = 'unparseable',

  // ai connection (B-117) + ai uses (B-118)
  AiNotConfigured = 'ai_not_configured',
  AiUnauthorized = 'ai_unauthorized',
  AiUnreachable = 'ai_unreachable',
  AiBadResponse = 'ai_bad_response',
  AiRateLimited = 'ai_rate_limited',
  AiUnavailable = 'ai_unavailable',

  // integrations — Home Assistant proxy (B-180)
  HaNotConfigured = 'ha_not_configured',
  HaUnauthorized = 'ha_unauthorized',
  HaEntityNotFound = 'ha_entity_not_found',
  HaNoMeasurement = 'ha_no_measurement',
  HaUnavailable = 'ha_unavailable',
  HaUnreachable = 'ha_unreachable',
  HaBadResponse = 'ha_bad_response',

  // integrations — BarclaudeGateway proxy (B-181/B-182)
  GatewayNotConfigured = 'gateway_not_configured',
  GatewayUnauthorized = 'gateway_unauthorized',
  GatewayUnavailable = 'gateway_unavailable',
  GatewayUnreachable = 'gateway_unreachable',
  GatewayBadResponse = 'gateway_bad_response',
  GatewayNotFound = 'gateway_not_found',

  // reserved (inert in v1)
  NotImplemented = 'not_implemented',
}
