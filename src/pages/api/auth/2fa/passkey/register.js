import { query } from '../../../../../lib/db.js';
import { getSessionUser } from '../../../../../lib/auth/session.js';
import { verifyRegistration } from '../../../../../lib/auth/passkey.js';

export const prerender = false;

export async function POST({ request, cookies }) {
    try {
        const user = await getSessionUser(cookies);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { credential, deviceName } = await request.json();

        if (!credential || !deviceName) {
            return new Response(JSON.stringify({ error: 'Credential and device name are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get stored challenge from session
        const session = JSON.parse(cookies.get('session')?.value || '{}');
        const challengeData = session.passkeyChallenge;

        if (!challengeData || !challengeData.challenge) {
            return new Response(JSON.stringify({ error: 'No challenge found. Please start the registration process again.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if challenge has expired
        if (Date.now() > challengeData.expires) {
            return new Response(JSON.stringify({ error: 'Challenge has expired. Please start the registration process again.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verify and store the passkey
        const passkey = await verifyRegistration(
            user.id,
            credential,
            challengeData.challenge,
            deviceName.trim()
        );

        // Clear the challenge from session
        delete session.passkeyChallenge;
        cookies.set('session', JSON.stringify(session), {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        return new Response(JSON.stringify({ 
            success: true,
            passkey: {
                id: passkey.id,
                deviceName: passkey.device_name,
                createdAt: passkey.created_at
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Passkey registration error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to register passkey' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
