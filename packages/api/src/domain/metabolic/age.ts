// Derived age (spec/logic/metabolic-engine.md §1): whole years between a birthdate
// and the reference date. Age is recomputed against the reference date, never stored.
// Computed in UTC so it is independent of the server's local timezone.

/** Whole years between `birthdate` and `refDate` (the day being computed). */
export function ageYears(birthdate: Date, refDate: Date): number {
  let age = refDate.getUTCFullYear() - birthdate.getUTCFullYear();
  const monthDelta = refDate.getUTCMonth() - birthdate.getUTCMonth();
  const beforeBirthday =
    monthDelta < 0 || (monthDelta === 0 && refDate.getUTCDate() < birthdate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
