import { describe, expect, it, vi } from 'vitest';
import { BACKOFF, ChannelStatus, LinkState, backoffDelay, createLink } from './connection-link';

function harness(options: { online?: boolean; random?: number } = {}) {
	const timers: Array<{ run: () => void; ms: number; cancelled: boolean }> = [];
	let online = options.online ?? true;
	const port = {
		open: vi.fn(),
		close: vi.fn(),
		resync: vi.fn(),
		onState: vi.fn(),
		online: () => online,
		random: () => options.random ?? 1,
		schedule: (run: () => void, ms: number) => {
			const timer = { run, ms, cancelled: false };
			timers.push(timer);
			return () => { timer.cancelled = true; };
		}
	};
	const link = createLink(port);
	const fire = () => {
		const due = timers.filter((t) => !t.cancelled);
		timers.length = 0;
		for (const timer of due) {
			timer.run();
		}
	};
	const pending = () => timers.filter((t) => !t.cancelled).map((t) => t.ms);
	return { link, port, fire, pending, goOffline: () => { online = false; }, goOnline: () => { online = true; } };
}

describe('the realtime link', () => {
	it('starts connecting and is connected once the channel subscribes', () => {
		const { link, port } = harness();
		link.start();
		expect(link.state()).toBe(LinkState.Connecting);
		expect(port.open).toHaveBeenCalledTimes(1);

		link.channel(ChannelStatus.Subscribed);
		expect(link.state()).toBe(LinkState.Connected);
		expect(port.onState.mock.calls.map(([s]) => s)).toEqual([LinkState.Connecting, LinkState.Connected]);
	});

	it('starts offline without opening when the browser is offline', () => {
		const { link, port } = harness({ online: false });
		link.start();
		expect(link.state()).toBe(LinkState.Offline);
		expect(port.open).not.toHaveBeenCalled();
	});

	for (const failure of [ChannelStatus.Error, ChannelStatus.TimedOut, ChannelStatus.Closed]) {
		it(`${failure} closes the channel and retries later, reconnecting`, () => {
			const { link, port, fire, pending } = harness();
			link.start();
			link.channel(ChannelStatus.Subscribed);

			link.channel(failure);
			expect(link.state()).toBe(LinkState.Reconnecting);
			expect(port.close).toHaveBeenCalledTimes(1);
			expect(port.open).toHaveBeenCalledTimes(1);
			expect(pending()).toEqual([BACKOFF.baseMs]);

			fire();
			expect(port.open).toHaveBeenCalledTimes(2);
		});
	}

	it('backs off exponentially up to the cap, and resets after a success', () => {
		const { link, fire, pending } = harness();
		link.start();
		const delays: number[] = [];
		for (let i = 0; i < 8; i++) {
			link.channel(ChannelStatus.Error);
			delays.push(...pending());
			fire();
		}
		expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);

		link.channel(ChannelStatus.Subscribed);
		link.channel(ChannelStatus.Error);
		expect(pending()).toEqual([BACKOFF.baseMs]);
	});

	it('jitters each delay between half and all of the step', () => {
		expect(backoffDelay(2, () => 0)).toBe(2000);
		expect(backoffDelay(2, () => 1)).toBe(4000);
		expect(backoffDelay(20, () => 0.5)).toBe(22500);
	});

	it('resyncs every time the channel (re)subscribes, so missed changes are fetched', () => {
		const { link, port, fire } = harness();
		link.start();
		link.channel(ChannelStatus.Subscribed);
		expect(port.resync).toHaveBeenCalledTimes(1);

		link.channel(ChannelStatus.Closed);
		fire();
		link.channel(ChannelStatus.Subscribed);
		expect(port.resync).toHaveBeenCalledTimes(2);
	});

	it('going offline drops the retry and shows offline; coming back reconnects at once', () => {
		const { link, port, pending, goOffline, goOnline } = harness();
		link.start();
		link.channel(ChannelStatus.Subscribed);

		goOffline();
		link.offline();
		expect(link.state()).toBe(LinkState.Offline);
		link.channel(ChannelStatus.Error);
		expect(link.state()).toBe(LinkState.Offline);
		expect(pending()).toEqual([]);

		goOnline();
		link.online();
		expect(link.state()).toBe(LinkState.Reconnecting);
		expect(port.open).toHaveBeenCalledTimes(2);
	});

	it('a tab becoming visible retries at once instead of waiting out the backoff', () => {
		const { link, port, pending } = harness();
		link.start();
		for (let i = 0; i < 5; i++) {
			link.channel(ChannelStatus.Error);
		}
		expect(pending()).toEqual([16000]);

		link.visible();
		expect(pending()).toEqual([]);
		expect(port.open).toHaveBeenCalledTimes(2);
	});

	it('a visible or online signal while connected changes nothing', () => {
		const { link, port } = harness();
		link.start();
		link.channel(ChannelStatus.Subscribed);
		link.visible();
		link.online();
		expect(port.open).toHaveBeenCalledTimes(1);
		expect(port.close).not.toHaveBeenCalled();
	});

	it('after stop nothing reopens', () => {
		const { link, port, fire } = harness();
		link.start();
		link.channel(ChannelStatus.Error);
		link.stop();
		fire();
		link.online();
		link.channel(ChannelStatus.Subscribed);
		expect(port.open).toHaveBeenCalledTimes(1);
		expect(port.resync).not.toHaveBeenCalled();
	});
});
