import { GitHub, Google } from "arctic";
import { envConfig } from "./env-config";
export function createOAuthClients() {
	const github = new GitHub(
		envConfig.GITHUB_CLIENT_ID,
		envConfig.GITHUB_CLIENT_SECRET,
		envConfig.GITHUB_REDIRECT_URI
	);

	// const google = new Google(
	// 	envConfig.GOOGLE_CLIENT_ID,
	// 	envConfig.GOOGLE_CLIENT_SECRET,
	// 	envConfig.GOOGLE_REDIRECT_URI
	// );

	return { github, google: null };
}

// We'll also need a type for the clients object
export type OAuthClients = ReturnType<typeof createOAuthClients>; 