// Example: src/pages/api/profile.js
export async function post(params, request) {
	const profile = await request.json()
	await saveProfile(profile)
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
		},
	})
}
