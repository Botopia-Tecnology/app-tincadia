import { RoomServiceClient } from 'livekit-server-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load credentials from the backend chat-ms .env
dotenv.config({ path: path.resolve(__dirname, '..', 'Tincadia-backend', 'Tincadia-backend', 'chat-ms', '.env') });

const LIVEKIT_HOST = process.env.LIVEKIT_URL!;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

async function purgeAllRooms() {
    if (!LIVEKIT_HOST || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        console.error('❌ Missing LiveKit credentials. Check chat-ms/.env');
        return;
    }

    console.log(`Connecting to LiveKit at ${LIVEKIT_HOST}...`);

    const roomService = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    try {
        console.log('Fetching active rooms...');
        const rooms = await roomService.listRooms();

        if (rooms.length === 0) {
            console.log('✅ No active rooms found. The server is completely clean.');
            return;
        }

        console.log(`🧹 Found ${rooms.length} active (ghost) rooms. Purging...`);
        let purgedParticipants = 0;

        for (const room of rooms) {
            console.log(`\nClosing room: ${room.name} (${room.numParticipants} participants)`);

            // Delete the room entirely, forcing all participants out instantly
            await roomService.deleteRoom(room.name);
            purgedParticipants += room.numParticipants;

            console.log(`✅ Closed ${room.name}`);
        }

        console.log(`\n🎉 Success! Purged ${rooms.length} rooms and forcibly disconnected ~${purgedParticipants} ghost participants.`);
        console.log('Your concurrent usage should now be back to 0%.');
    } catch (error) {
        console.error('❌ Failed to purge rooms:', error);
    }
}

purgeAllRooms();
