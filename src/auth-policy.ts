export const passwordPolicyMessage =
  'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتتضمن حرفاً ورقماً.'

export function validNewPassword(password: string): boolean {
  return [...password].length >= 8 && /\p{L}/u.test(password) && /\p{N}/u.test(password)
}
