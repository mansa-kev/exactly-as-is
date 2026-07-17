// Centralized error handling and security utilities
export type ErrorType = 'auth' | 'network' | 'validation' | 'database' | 'file' | 'default';

interface ErrorContext {
  operation: string;
  userId?: string;
  resource?: string;
  action?: string;
}

// Sanitized error messages for client-side display
const CLIENT_ERROR_MESSAGES: Record<ErrorType, string> = {
  auth: 'Authentication failed. Please check your credentials and try again.',
  network: 'Network connection error. Please check your internet connection and try again.',
  validation: 'Invalid data provided. Please check your input and try again.',
  database: 'Data operation failed. Please try again or contact support if the problem persists.',
  file: 'File operation failed. Please check the file format and size, then try again.',
  default: 'An error occurred. Please try again or contact support if the problem continues.'
};

/**
 * Sanitizes error messages for client-side display
 * Logs full error details server-side for debugging
 * @param error - The original error object
 * @param type - Type of error for categorization
 * @param context - Additional context for logging
 * @returns Sanitized error message
 */
export const sanitizeError = (
  error: any, 
  type: ErrorType = 'default',
  context?: ErrorContext
): string => {
  // Log full error details for debugging (server-side only)
  const logData = {
    type,
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
  };

  // In production, you'd send this to your logging service
  console.error('[SECURITY_LOG]', JSON.stringify(logData));

  // Return generic message to client
  return CLIENT_ERROR_MESSAGES[type] || CLIENT_ERROR_MESSAGES.default;
};

/**
 * Handles Supabase errors with sanitization
 * @param error - Supabase error object
 * @param operation - The operation being performed
 * @returns Sanitized error message
 */
export const handleSupabaseError = (error: any, operation: string): string => {
  let errorType: ErrorType = 'default';

  // Categorize error based on Supabase error codes
  if (error?.code) {
    switch (error.code) {
      case 'PGRST116': // Not found
      case 'PGRST301': // No rows returned
        errorType = 'database';
        break;
      case '23505': // Unique violation
      case '23503': // Foreign key violation
      case '23514': // Check violation
        errorType = 'validation';
        break;
      case '28P01': // Invalid password
      case '28000': // Invalid authorization
        errorType = 'auth';
        break;
      case '08006': // Connection failure
      case '08001': // Connection doesn't exist
        errorType = 'network';
        break;
      default:
        errorType = 'default';
    }
  }

  return sanitizeError(error, errorType, {
    operation,
    action: 'supabase_operation'
  });
};

/**
 * Creates a secure data access wrapper with ownership checks
 * @param userId - Current user ID
 * @returns Secure data access object
 */
export const createSecureDataAccess = (userId: string) => {
  return {
    // Secure select with ownership filter
    select: (table: string, columns = '*') => {
      // This would be implemented with your Supabase client
      // Always includes user_id filter for ownership
      return {
        table,
        columns,
        userId,
        filters: { user_id: userId }
      };
    },

    // Secure insert with user ownership
    insert: (table: string, data: any) => {
      return {
        table,
        data: {
          ...data,
          user_id: userId, // Always include user ownership
          created_at: new Date().toISOString()
        }
      };
    },

    // Secure update with ownership verification
    update: (table: string, id: string, data: any) => {
      return {
        table,
        id,
        data: {
          ...data,
          updated_at: new Date().toISOString()
        },
        userId, // For WHERE clause: user_id = userId AND id = id
        condition: `user_id = '${userId}' AND id = '${id}'`
      };
    },

    // Secure delete with ownership verification
    delete: (table: string, id: string) => {
      return {
        table,
        id,
        userId,
        condition: `user_id = '${userId}' AND id = '${id}'`
      };
    }
  };
};

/**
 * Validates user ownership of a resource
 * @param resource - The resource to check
 * @param userId - Current user ID
 * @returns boolean indicating ownership
 */
export const validateOwnership = (resource: any, userId: string): boolean => {
  if (!resource || !userId) return false;
  
  // Check various possible user ID fields
  const resourceUserId = resource.user_id || 
                        resource.userId || 
                        resource.owner_id || 
                        resource.ownerId;
  
  return resourceUserId === userId;
};

/**
 * Wraps async functions with error handling and logging
 * @param fn - The async function to wrap
 * @param errorType - Type of error for categorization
 * @param context - Additional context for logging
 * @returns Wrapped function with error handling
 */
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorType: ErrorType = 'default',
  context?: ErrorContext
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const sanitizedMessage = sanitizeError(error, errorType, context);
      throw new Error(sanitizedMessage);
    }
  };
};

/**
 * Security monitoring utility
 */
export const securityMonitor = {
  // Log suspicious activities
  logSuspiciousActivity: (activity: string, details: any) => {
    const logEntry = {
      activity,
      details,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    };
    
    console.warn('[SECURITY_ALERT]', JSON.stringify(logEntry));
    
    // In production, send to security monitoring service
    // await securityService.logSuspiciousActivity(logEntry);
  },

  // Monitor failed authentication attempts
  logAuthFailure: (email: string, ip: string, reason: string) => {
    securityMonitor.logSuspiciousActivity('AUTH_FAILURE', {
      email,
      ip,
      reason,
      timestamp: new Date().toISOString()
    });
  },

  // Monitor potential IDOR attempts
  logIdorAttempt: (userId: string, resourceId: string, resource: string) => {
    securityMonitor.logSuspiciousActivity('POTENTIAL_IDOR', {
      userId,
      resourceId,
      resource,
      timestamp: new Date().toISOString()
    });
  }
};
