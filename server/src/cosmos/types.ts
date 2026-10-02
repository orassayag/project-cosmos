export type * from './apiTypes.js';

export type ValidationSeverity = 'error' | 'warn';

export interface CosmosValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  context: Record<string, unknown>;
}
