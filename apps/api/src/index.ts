import { createAppInstance, AppConfig } from "./create-app";

const config: AppConfig = {};

// Create the main application instance using the factory
const appInstance = createAppInstance(config); // Pass empty/minimal deps

// Export the configured app instance for the server/runtime
export default appInstance;