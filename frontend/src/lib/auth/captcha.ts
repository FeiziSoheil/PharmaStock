/** Generate a 4-digit Latin captcha challenge (display via toPersianDigits). */
export function generateCaptchaCode(): string {
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += String(Math.floor(Math.random() * 10))
  }
  return code
}
