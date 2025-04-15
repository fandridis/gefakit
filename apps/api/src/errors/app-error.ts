// src/lib/app-error.ts
export class AppError extends Error {
    readonly status: number;
    readonly details?: Record<string, any>;
  
    constructor(message: string, status = 400, details?: Record<string, any>) {
      super(message);
      // Set the prototype explicitly for correct instanceof checks
      Object.setPrototypeOf(this, new.target.prototype);
  
      this.name = 'AppError'; // Consistent name for easy identification
      this.status = status;
      this.details = details;
    }
  }