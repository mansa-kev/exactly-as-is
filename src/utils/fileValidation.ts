// File validation utilities for secure file uploads
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileInfo: {
    name: string;
    size: number;
    type: string;
    isImage: boolean;
  };
}

// Allowed file types and their magic bytes
const ALLOWED_TYPES = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    magicBytes: [0xFF, 0xD8, 0xFF],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  'image/png': {
    extensions: ['.png'],
    magicBytes: [0x89, 0x50, 0x4E, 0x47],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  'image/webp': {
    extensions: ['.webp'],
    magicBytes: [0x52, 0x49, 0x46, 0x46],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  'application/pdf': {
    extensions: ['.pdf'],
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    maxSize: 10 * 1024 * 1024, // 10MB for PDFs
  },
};

/**
 * Validates a file for secure upload
 * @param file - The file to validate
 * @returns Promise<FileValidationResult>
 */
export const validateFile = async (file: File): Promise<FileValidationResult> => {
  const result: FileValidationResult = {
    isValid: false,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      isImage: file.type.startsWith('image/'),
    },
  };

  try {
    // 1. Check if file type is allowed
    const typeConfig = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
    if (!typeConfig) {
      result.error = `File type ${file.type} is not allowed. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`;
      return result;
    }

    // 2. Check file size
    if (file.size > typeConfig.maxSize) {
      const maxSizeMB = typeConfig.maxSize / (1024 * 1024);
      result.error = `File size exceeds ${maxSizeMB}MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
      return result;
    }

    // 3. Validate file extension matches type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!typeConfig.extensions.includes(fileExtension)) {
      result.error = `File extension ${fileExtension} doesn't match content type ${file.type}`;
      return result;
    }

    // 4. Validate magic bytes (actual file content)
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Check if file starts with expected magic bytes
    const magicBytesMatch = typeConfig.magicBytes.every((byte, index) => {
      return uint8Array[index] === byte;
    });

    if (!magicBytesMatch) {
      result.error = 'File content does not match its extension. This may be a malicious file.';
      return result;
    }

    // 5. Check for suspicious file names
    const suspiciousPatterns = [
      /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i,
      /\.php$/i, /\.asp$/i, /\.jsp$/i, /\.sh$/i,
      /\.\./, /\/\//, /[<>:"|?*]/
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      result.error = 'File name contains suspicious characters or patterns.';
      return result;
    }

    // All validations passed. Image decoding is intentionally deferred to the
    // compression/upload pipeline to avoid decoding the same mobile photo twice.
    result.isValid = true;
    return result;

  } catch (error) {
    result.error = `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
};

/**
 * Validates multiple files
 * @param files - Array of files to validate
 * @returns Promise<FileValidationResult[]>
 */
export const validateMultipleFiles = async (files: File[]): Promise<FileValidationResult[]> => {
  const results = await Promise.all(files.map(file => validateFile(file)));
  return results;
};

/**
 * Sanitizes file name for secure storage
 * @param fileName - Original file name
 * @returns Sanitized file name
 */
export const sanitizeFileName = (fileName: string): string => {
  // Remove path separators and special characters
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  // Ensure the filename isn't empty after sanitization
  if (!sanitized || sanitized === '.') {
    return `file_${Date.now()}`;
  }

  return sanitized;
};

/**
 * Generates a secure file path for storage
 * @param userId - User ID for personal storage
 * @param fileName - Sanitized file name
 * @returns Secure storage path
 */
export const generateSecurePath = (userId: string, fileName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const sanitizedName = sanitizeFileName(fileName);
  
  return `${userId}/${timestamp}_${random}_${sanitizedName}`;
};
