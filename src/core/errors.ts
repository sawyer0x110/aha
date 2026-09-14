export class AhaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly path = '/',
  ) {
    super(message);
    this.name = 'AhaError';
  }
}

export function fail(code: string, message: string, path = '/'): never {
  throw new AhaError(code, message, path);
}
