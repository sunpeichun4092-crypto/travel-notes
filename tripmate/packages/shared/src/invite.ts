// Invite-code helpers (must stay in sync with gen_invite_code() in the SQL).

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // I L O 0 1 removed

export function generateInviteCode(len = 6): string {
  let out = '';
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function isValidInviteCode(code: string): boolean {
  if (code.length !== 6) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
