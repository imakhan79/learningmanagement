/*
  Extend profiles.status to support HR off-boarding lifecycle statuses.
  Students moving out of active enrollment are tracked as graduated,
  withdrawn, or terminated rather than the generic inactive/suspended.
*/

ALTER TABLE profiles DROP CONSTRAINT profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active','inactive','suspended','pending_activation','graduated','withdrawn','terminated'));
