export function persistJwt(jwt: string): void {
  sessionStorage.setItem('auth_jwt', jwt);
}
