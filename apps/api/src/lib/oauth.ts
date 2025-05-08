import { GitHub, Google } from "arctic";
export function createOAuthClients() {
	const github = new GitHub(
		process.env.GITHUB_CLIENT_ID,
		process.env.GITHUB_CLIENT_SECRET,
		process.env.GITHUB_REDIRECT_URI
	);

	// const google = new Google(
	// 	process.env.GOOGLE_CLIENT_ID,
	// 	process.env.GOOGLE_CLIENT_SECRET,
	// 	process.env.GOOGLE_REDIRECT_URI
	// );

	return { github, google: null };
}

// We'll also need a type for the clients object
export type OAuthClients = ReturnType<typeof createOAuthClients>; 