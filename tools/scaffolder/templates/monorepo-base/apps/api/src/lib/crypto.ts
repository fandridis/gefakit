import bcrypt from "bcryptjs";

/**
     * Asynchronously hashes a password using bcrypt.
     *
     * @param password - The plaintext password to hash.
     * @param saltRounds - The cost factor (number of salt rounds) for hashing (default is 12).
     * @returns A Promise that resolves to the hashed password.
     */
export async function hashPassword(password: string, saltRounds: number = 12) {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
}

/**
 * Asynchronously verifies a password against a given hash.
 *
 * @param password - The plaintext password to verify.
 * @param hash - The hashed password to compare against.
 * @returns A Promise that resolves to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(password: string, hash: string) {
    const result = await bcrypt.compare(password, hash);
    return result;
}


/**
 * Checks if a password has been compromised using the Pwned Passwords API.
 *
 * @param password - The password to check.
 * @returns A Promise that resolves to true if the password has been compromised, false otherwise.
 */
export async function isMyPasswordPwned(password: string): Promise<boolean> {
    try {
        // Encode the password as a Uint8Array.
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
      
        // Generate the SHA‑1 hash using Web Crypto API.
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      
        // Convert the ArrayBuffer to a hexadecimal string.
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha1Hash = hashArray
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
      
        // Split the hash into the first 5 characters (prefix) and the rest (suffix).
        const prefix = sha1Hash.slice(0, 5);
        const suffix = sha1Hash.slice(5);

        // Request the API with the hash prefix.
        const url = `https://api.pwnedpasswords.com/range/${prefix}`;
        const response = await fetch(url);
        if (!response.ok) {
            return false;
        }
      
        // The API response is plain text, with each line in the format "HASH_SUFFIX:COUNT".
        const body = await response.text();
        const lines = body.split('\n');
      
        // Check if any of the returned suffixes match the remainder of our hash.
        for (const line of lines) {
          const [returnedSuffix] = line.split(':');
          if (returnedSuffix.trim() === suffix) {
            // Password found as compromised.
            return true;
          }
        }
      
        // Password not found.
        return false;
    } catch (error) {
        // If any error occurs (network issues, API problems, etc.), consider the password safe
        return false;
    }
}
