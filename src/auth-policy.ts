export const passwordPolicyMessage =
  'Password must be at least 8 characters and include a letter and a number.'

export function validNewPassword(password: string): boolean {
  return [...password].length >= 8 && /\p{L}/u.test(password) && /\p{N}/u.test(password)
}
