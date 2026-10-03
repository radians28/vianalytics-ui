// Mirrors the backend's password rule (app/common/validators.py) so the user
// gets immediate, specific feedback instead of a generic rejection.
export function validatePasswordComplexity(value: string): string {
  if (value.length < 8 || value.length > 20) return 'Password must be 8-20 characters long.';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.';
  if (!/\d/.test(value)) return 'Password must contain at least one digit.';
  if (!/[!@#$%^&*(),.?":{}|<>_]/.test(value)) return 'Password must contain at least one special character.';
  return '';
}
