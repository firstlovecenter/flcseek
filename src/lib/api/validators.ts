/**
 * Input Validation Utilities
 * Common validation functions for API inputs
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate required fields are present
 */
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[]
): ValidationResult {
  const errors: string[] = [];
  
  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`${field} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate string field
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    patternMessage?: string;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: errors.length === 0, errors };
  }
  
  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
    return { valid: false, errors };
  }
  
  if (options.minLength && value.length < options.minLength) {
    errors.push(`${fieldName} must be at least ${options.minLength} characters`);
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    errors.push(`${fieldName} must be at most ${options.maxLength} characters`);
  }
  
  if (options.pattern && !options.pattern.test(value)) {
    errors.push(options.patternMessage || `${fieldName} has invalid format`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown, required = false): ValidationResult {
  return validateString(value, 'email', {
    required,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'Invalid email format',
  });
}

/**
 * Validate phone number format (Ghana format)
 */
export function validatePhone(value: unknown, required = false): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    if (required) {
      errors.push('Phone number is required');
    }
    return { valid: errors.length === 0, errors };
  }
  
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Phone number must be a string'] };
  }
  
  // Clean phone number - remove spaces, dashes, plus signs
  const cleaned = value.replace(/[\s\-+]/g, '');
  
  // Ghana phone validation: 10 digits starting with 0, or 12 digits with 233 prefix
  const ghanaPattern = /^(0\d{9}|233\d{9})$/;
  
  if (!ghanaPattern.test(cleaned)) {
    errors.push('Invalid phone number format. Use 0XX-XXX-XXXX or 233-XX-XXX-XXXX');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate UUID format
 */
export function validateUUID(value: unknown, fieldName = 'id'): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    return { valid: false, errors: [`${fieldName} is required`] };
  }
  
  if (typeof value !== 'string') {
    return { valid: false, errors: [`${fieldName} must be a string`] };
  }
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidPattern.test(value)) {
    errors.push(`${fieldName} must be a valid UUID`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate integer
 */
export function validateInt(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: errors.length === 0, errors };
  }
  
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (typeof num !== 'number' || isNaN(num)) {
    errors.push(`${fieldName} must be a number`);
    return { valid: false, errors };
  }
  
  if (!Number.isInteger(num)) {
    errors.push(`${fieldName} must be an integer`);
  }
  
  if (options.min !== undefined && num < options.min) {
    errors.push(`${fieldName} must be at least ${options.min}`);
  }
  
  if (options.max !== undefined && num > options.max) {
    errors.push(`${fieldName} must be at most ${options.max}`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate year
 */
export function validateYear(value: unknown, required = false): ValidationResult {
  const currentYear = new Date().getFullYear();
  return validateInt(value, 'year', {
    required,
    min: 2020,
    max: currentYear + 1,
  });
}

/**
 * Validate role
 */
export function validateRole(value: unknown): ValidationResult {
  const validRoles = ['superadmin', 'leadpastor', 'admin', 'leader'];
  
  if (!value) {
    return { valid: false, errors: ['Role is required'] };
  }
  
  if (!validRoles.includes(value as string)) {
    return { 
      valid: false, 
      errors: [`Role must be one of: ${validRoles.join(', ')}`] 
    };
  }
  
  return { valid: true, errors: [] };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(r => r.errors);
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Person data validation
 */
export function validatePersonData(data: Record<string, unknown>): ValidationResult {
  return combineValidations(
    validateString(data.first_name, 'first_name', { required: true, minLength: 1, maxLength: 100 }),
    validateString(data.last_name, 'last_name', { required: true, minLength: 1, maxLength: 100 }),
    validatePhone(data.phone_number, true),
    validateString(data.gender, 'gender', { 
      pattern: /^(male|female|other)$/i,
      patternMessage: 'Gender must be male, female, or other'
    }),
  );
}

/**
 * User data validation
 */
export function validateUserData(data: Record<string, unknown>, isCreate = true): ValidationResult {
  const validations: ValidationResult[] = [
    validateString(data.username, 'username', { 
      required: isCreate, 
      minLength: 3, 
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_]+$/,
      patternMessage: 'Username can only contain letters, numbers, and underscores'
    }),
  ];
  
  if (isCreate || data.password) {
    validations.push(
      validateString(data.password, 'password', { required: isCreate, minLength: 8 })
    );
  }
  
  if (data.role) {
    validations.push(validateRole(data.role));
  }
  
  if (data.email) {
    validations.push(validateEmail(data.email));
  }
  
  return combineValidations(...validations);
}

/**
 * Group data validation
 */
export function validateGroupData(data: Record<string, unknown>): ValidationResult {
  return combineValidations(
    validateString(data.name, 'name', { required: true, minLength: 1, maxLength: 50 }),
  );
}
