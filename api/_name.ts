/** The inviter's first name from the link: letters only (plus ' and -), at most 16 characters. */
export function firstName(raw: string | null): string {
  const n = (raw || "").trim().split(/\s+/)[0] || "";
  return n.replace(/[^\p{L}'-]/gu, "").slice(0, 16);
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
