import { getSessionUser } from '../../../../../lib/auth/session.js';
import { getUserPasskeys } from '../../../../../lib/auth/passkey.js';

export const prerender = false;

export async function GET({ cookies }) {
    try {
        const user = await getSessionUser(cookies);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const passkeys = await getUserPasskeys(user.id);

        // Return passkeys with safe information (exclude sensitive crypto data)
        const safePasskeys = passkeys.map(pk => ({
            id: pk.id,
            deviceName: pk.device_name,
            createdAt: pk.created_at,
            lastUsedAt: pk.last_used_at
        }));

        return new Response(JSON.stringify({ passkeys: safePasskeys }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('List passkeys error:', error);
        return new Response(JSON.stringify({ error: 'Failed to list passkeys' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
