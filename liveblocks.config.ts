import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
    authEndpoint: "/api/liveblocks-auth",
});

export const {
    suspense: {
        RoomProvider,
        useRoom,
        useMyPresence,
        useUpdateMyPresence,
        useSelf,
        useOthers,
        useOthersMapped,
        useOthersConnectionIds,
        useOther,
        useBroadcastEvent,
        useEventListener,
        useErrorListener,
        useStorage,
        useHistory,
        useUndo,
        useRedo,
        useCanUndo,
        useCanRedo,
        useMutation,
        useStatus,
        useLostConnectionListener,
    },
} = createRoomContext<any, any>(client);
