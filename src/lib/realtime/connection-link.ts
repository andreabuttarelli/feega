export enum LinkState {
	Connecting = 'connecting',
	Connected = 'connected',
	Reconnecting = 'reconnecting',
	Offline = 'offline'
}

export enum ChannelStatus {
	Subscribed = 'SUBSCRIBED',
	Error = 'CHANNEL_ERROR',
	TimedOut = 'TIMED_OUT',
	Closed = 'CLOSED'
}

export const BACKOFF = { baseMs: 1_000, capMs: 30_000 };

export const LINK_DOT: Record<LinkState, { tone: string; label: string }> = {
	[LinkState.Connected]: { tone: 'var(--link-live)', label: 'Live — changes sync in real time' },
	[LinkState.Connecting]: { tone: 'var(--link-pending)', label: 'Connecting…' },
	[LinkState.Reconnecting]: { tone: 'var(--link-pending)', label: 'Reconnecting — your edits are kept' },
	[LinkState.Offline]: { tone: 'var(--link-down)', label: 'Offline — edits will sync when you are back' }
};

export type LinkPort = {
	open: () => void;
	close: () => void;
	resync: () => void;
	onState: (state: LinkState) => void;
	online: () => boolean;
	random: () => number;
	schedule: (run: () => void, ms: number) => () => void;
};

export function backoffDelay(attempt: number, random: () => number): number {
	const step = Math.min(BACKOFF.capMs, BACKOFF.baseMs * 2 ** attempt);
	return Math.round(step / 2 + (random() * step) / 2);
}

export function createLink(port: LinkPort) {
	let state: LinkState | null = null;
	let attempt = 0;
	let stopped = false;
	let cancelRetry: (() => void) | null = null;

	function enter(next: LinkState) {
		if (next === state) {
			return;
		}
		state = next;
		port.onState(next);
	}

	function dropRetry() {
		cancelRetry?.();
		cancelRetry = null;
	}

	function retryLater() {
		dropRetry();
		const delay = backoffDelay(attempt, port.random);
		attempt += 1;
		cancelRetry = port.schedule(() => {
			cancelRetry = null;
			if (!stopped) {
				port.open();
			}
		}, delay);
	}

	function retryNow() {
		if (stopped || state === LinkState.Connected || !port.online()) {
			return;
		}
		dropRetry();
		attempt = 0;
		port.close();
		enter(LinkState.Reconnecting);
		port.open();
	}

	return {
		state: () => state ?? LinkState.Connecting,

		start() {
			if (!port.online()) {
				enter(LinkState.Offline);
				return;
			}
			enter(LinkState.Connecting);
			port.open();
		},

		channel(status: ChannelStatus) {
			if (stopped) {
				return;
			}
			if (status === ChannelStatus.Subscribed) {
				dropRetry();
				attempt = 0;
				enter(LinkState.Connected);
				port.resync();
				return;
			}
			port.close();
			if (!port.online()) {
				dropRetry();
				enter(LinkState.Offline);
				return;
			}
			enter(LinkState.Reconnecting);
			retryLater();
		},

		offline() {
			if (stopped) {
				return;
			}
			dropRetry();
			port.close();
			enter(LinkState.Offline);
		},

		online: retryNow,
		visible: retryNow,

		stop() {
			stopped = true;
			dropRetry();
		}
	};
}

export type Link = ReturnType<typeof createLink>;
