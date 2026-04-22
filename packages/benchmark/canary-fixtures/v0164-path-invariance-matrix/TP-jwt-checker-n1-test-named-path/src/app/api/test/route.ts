// Route at N1-class path. Scanner must flag the token-signing pattern.
import jwt from 'jsonwebtoken';

export function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string);
}
