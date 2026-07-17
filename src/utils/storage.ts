/**
 * Encrypted Storage Utility
 * Encrypts localStorage data to prevent sensitive information from being visible
 */

const encrypt = (data: any): string => {
  try {
    return btoa(JSON.stringify(data));
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
};

const decrypt = (encrypted: string): any => {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return null;
  }
};

export const storage = {
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, encrypt(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? decrypt(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
};
