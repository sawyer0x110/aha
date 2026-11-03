export interface Diagnostic {
  code: string;
  message: string;
  path: string;
  suggestion: string;
  file?: string;
}

export class AhaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly path = '/',
    public readonly diagnostics?: Diagnostic[],
  ) {
    super(message);
    this.name = 'AhaError';
  }
}

export function failDiagnostics(diagnostics: Diagnostic[]): void {
  const first = diagnostics[0];
  if (first) throw new AhaError(first.code, first.message, first.path, diagnostics);
}

export function fail(code: string, message: string, path = '/'): never {
  throw new AhaError(code, message, path);
}
