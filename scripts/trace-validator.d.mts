import type { ValidationIssue, ValidationResult } from '../src/types/trace';
export function validateTraceLensJson(raw: unknown): ValidationResult;
export function benchmarkMetadataIssues(raw: unknown): ValidationIssue[];
export function evaluationMetadataIssues(raw: unknown): ValidationIssue[];
