export function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  if (!authHeader || Array.isArray(authHeader)) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}
