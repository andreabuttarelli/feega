import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { dedupePresence, type PresencePeer } from './presence-peers';
import { ChannelStatus, createLink, type LinkPort, type LinkState } from './connection-link';
import { FRAME_EVENT, type FrameLine } from './frame-presence';

export type CanvasChange = RealtimePostgresChangesPayload<Record<string, unknown>>;

export type LinkEnvironment = Pick<LinkPort, 'online' | 'random' | 'schedule'> & {
	watch: (on: { online: () => void; offline: () => void; visible: () => void }) => () => void;
};

type CanvasConnection = {
	client: SupabaseClient;
	canvasId: string;
	projectId: string;
	peer: PresencePeer;
	onChange: (change: CanvasChange) => void;
	onPeers: (peers: PresencePeer[]) => void;
	onReconnect: () => void;
	onCanvasList: () => void;
	onLink: (state: LinkState) => void;
	frames?: FrameLine;
	environment?: LinkEnvironment;
};

export const browserEnvironment: LinkEnvironment = {
	online: () => navigator.onLine,
	random: Math.random,
	schedule: (run, ms) => {
		const timer = setTimeout(run, ms);
		return () => clearTimeout(timer);
	},
	watch: (on) => {
		const visible = () => {
			if (document.visibilityState === 'visible') {
				on.visible();
			}
		};
		window.addEventListener('online', on.online);
		window.addEventListener('offline', on.offline);
		document.addEventListener('visibilitychange', visible);
		return () => {
			window.removeEventListener('online', on.online);
			window.removeEventListener('offline', on.offline);
			document.removeEventListener('visibilitychange', visible);
		};
	}
};

export function connectCanvas(options: CanvasConnection): () => void {
	const { client, canvasId, projectId, peer, onChange, onPeers, onReconnect, onCanvasList } = options;
	const environment = options.environment ?? browserEnvironment;
	let closed = false;
	let channel: RealtimeChannel | null = null;

	const link = createLink({
		...environment,
		open: () => {
			void join().catch(() => link.channel(ChannelStatus.Error));
		},
		close: leave,
		resync: onReconnect,
		onState: options.onLink
	});

	async function join(): Promise<void> {
		const { data } = await client.auth.getSession();
		if (closed || !data.session?.access_token) {
			return;
		}

		await client.realtime.setAuth(data.session.access_token);
		if (closed) {
			return;
		}

		leave();
		const joined = client.channel(`canvas:${canvasId}`, {
			config: { private: true, presence: { key: peer.userId } }
		});
		channel = joined;

		for (const table of ['nodes', 'nodes_connections']) {
			joined.on('postgres_changes', {
				event: '*', schema: 'public', table, filter: `canvas_id=eq.${canvasId}`
			}, (change) => {
				if (!closed) {
					onChange(change);
				}
			});
		}

		joined.on('postgres_changes', {
			event: '*', schema: 'public', table: 'canvases', filter: `project_id=eq.${projectId}`
		}, () => {
			if (!closed) {
				onCanvasList();
			}
		});

		joined.on('broadcast', { event: FRAME_EVENT }, (message) => {
			if (!closed && channel === joined) {
				options.frames?.receive(message.payload);
			}
		});

		joined.on('presence', { event: 'sync' }, () => {
			if (!closed && channel === joined) {
				onPeers(dedupePresence(joined.presenceState<Partial<PresencePeer>>(), peer.userId, peer));
			}
		});

		joined.subscribe((raw) => {
			if (closed || joined !== channel) {
				return;
			}
			const status = String(raw) as ChannelStatus;
			if (status === ChannelStatus.Subscribed) {
				void joined.track(peer).catch(() => {});
				options.frames?.attach((mark) => void joined.send({ type: 'broadcast', event: FRAME_EVENT, payload: mark }).catch(() => {}));
			}
			link.channel(status);
		});
	}

	function leave() {
		onPeers([]);
		options.frames?.attach(null);
		const dead = channel;
		channel = null;
		if (dead) {
			void client.removeChannel(dead);
		}
	}

	const unwatch = environment.watch({ online: link.online, offline: link.offline, visible: link.visible });
	link.start();

	return () => {
		closed = true;
		link.stop();
		unwatch();
		leave();
	};
}
