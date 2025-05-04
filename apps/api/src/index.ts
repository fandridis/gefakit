
import { createAppInstance, CoreAppVariables } from "./app-factory";

// --- Dependency Instantiation ---
// Services/Repos relying on per-request DB will be instantiated in middleware or routes.
// Only instantiate global/non-request-specific dependencies here.

// Assemble the dependencies object for AppConfig
// Include only dependencies instantiated here (if any in the future).
// For now, it might be empty if all services depend on per-request DB.
const dependencies: Partial<CoreAppVariables> = {
  // db: // DB handled per-request in middleware
  // todoService: // Instantiated per-request in routes/middleware
};

// Create the main application instance using the factory
// Pass the (potentially empty) dependencies object
const appInstance = createAppInstance({ dependencies });

// Export the configured app instance for the server/runtime
export default appInstance;
