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
  WeighInDateOccupied = 'weigh_in_date_occupied',
  WouldCreateCycle = 'would_create_cycle',
  PantryDuplicate = 'pantry_duplicate',

  // reserved (inert in v1)
  NotImplemented = 'not_implemented',
}
