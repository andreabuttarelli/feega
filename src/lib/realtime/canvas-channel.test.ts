import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { connectCanvas } from './canvas-channel';

function socket() {
	const listeners: Array<{ kind: string; filter: Record<string, string>; callback: (value?: any) => void }> = [];
	let status: (value: string) => void = () => {};
	const channel = {
		on: vi.fn((kind, filter, callback) => { listeners.push({ kind, filter, callback }); return channel; }),
		subscribe: vi.fn((callback) => { status = callback; return channel; }),
		track: vi.fn().mockResolvedValue('ok'),
		presenceState: vi.fn().mockReturnValue({})
	};
	const client = {
		auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
		realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
		channel: vi.fn().mockReturnValue(channel),
		removeChannel: vi.fn().mockResolvedValue('ok')
	};
	return { client, channel, listeners, status: (value: string) => status(value) };
}

const peer = { userId: 'me', name: 'Me', avatar: null, path: '/p/proj/c/canvas', threadId: null };

function open(connection: ReturnType<typeof socket>) {
	const onChange = vi.fn();
	const onPeers = vi.fn();
	const onReconnect = vi.fn();
	const onCanvasList = vi.fn();
	const close = connectCanvas({ client: connection.client as unknown as SupabaseClient, canvasId: 'canvas', projectId: 'proj', peer, onChange, onPeers, onReconnect, onCanvasList });
	return { close, onChange, onPeers, onReconnect, onCanvasList };
}

describe('canvas collaboration', () => {
	it('receives changes for both canvas tables and refreshes after reconnect', async () => {
		const connection = socket();
		const callbacks = open(connection);
		await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalled());
		expect(connection.client.channel).toHaveBeenCalledWith('canvas:canvas', { config: { private: true, presence: { key: 'me' } } });
		const changes = connection.listeners.filter(({ kind }) => kind === 'postgres_changes');
		expect(changes.map(({ filter }) => filter)).toEqual([
			{ event: '*', schema: 'public', table: 'nodes', filter: 'canvas_id=eq.canvas' },
			{ event: '*', schema: 'public', table: 'nodes_connections', filter: 'canvas_id=eq.canvas' },
			{ event: '*', schema: 'public', table: 'canvases', filter: 'project_id=eq.proj' }
		]);
		const event = { table: 'nodes', eventType: 'UPDATE', new: { id: 'node', canvas_id: 'canvas' }, old: {} };
		changes[0].callback(event);
		expect(callbacks.onChange).toHaveBeenCalledWith(event);
		connection.status('SUBSCRIBED');
		connection.status('SUBSCRIBED');
		expect(callbacks.onReconnect).toHaveBeenCalledTimes(2);
		expect(connection.channel.track).toHaveBeenCalledWith(peer);
		callbacks.close();
		expect(connection.client.removeChannel).toHaveBeenCalledWith(connection.channel);
	});
	it('shows each teammate once and ignores late events after leaving', async () => {
		const connection = socket();
		const callbacks = open(connection);
		await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalled());
		const teammate = { ...peer, userId: 'other', name: 'Other' };
		connection.channel.presenceState.mockReturnValue({ me: [peer], other: [teammate, teammate] });
		const sync = connection.listeners.find(({ kind }) => kind === 'presence')!;
		sync.callback();
		expect(callbacks.onPeers).toHaveBeenLastCalledWith([teammate]);
		callbacks.close();
		sync.callback();
		connection.status('SUBSCRIBED');
		connection.listeners[0].callback({ eventType: 'UPDATE' });
		expect(callbacks.onPeers).toHaveBeenLastCalledWith([]);
		expect(callbacks.onChange).not.toHaveBeenCalled();
		expect(callbacks.onReconnect).not.toHaveBeenCalled();
	});

	it('tells the shell when a canvas of the project is created, renamed or deleted', async () => {
		const connection = socket();
		const callbacks = open(connection);
		await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalled());
		const canvases = connection.listeners.find(({ filter }) => filter?.table === 'canvases')!;
		canvases.callback({ table: 'canvases', eventType: 'DELETE', old: { id: 'other' }, new: {} });
		expect(callbacks.onCanvasList).toHaveBeenCalledTimes(1);
		expect(callbacks.onChange).not.toHaveBeenCalled();
	});

	it('treats a soft delete (UPDATE with deleted_at set) as a removal from the canvas list, same as a DELETE', async () => {
		const connection = socket();
		const callbacks = open(connection);
		await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalled());
		const canvases = connection.listeners.find(({ filter }) => filter?.table === 'canvases')!;
		canvases.callback({
			table: 'canvases',
			eventType: 'UPDATE',
			old: { id: 'other' },
			new: { id: 'other', deleted_at: '2026-09-29T00:00:00.000Z' }
		});
		expect(callbacks.onCanvasList).toHaveBeenCalledTimes(1);
		expect(callbacks.onChange).not.toHaveBeenCalled();
	});

	it('does not join a canvas after navigation while authentication is pending', async () => {
		const connection = socket();
		const callbacks = open(connection);
		callbacks.close();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(connection.client.channel).not.toHaveBeenCalled();
	});


	it('a channel that closed or timed out while the tab slept is opened again, and the rejoin refreshes', async () => {
		for (const dead of ['CLOSED', 'TIMED_OUT']) {
			const connection = socket();
			const callbacks = open(connection);
			await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalledTimes(1));

			connection.status(dead);
			expect(connection.client.removeChannel).toHaveBeenCalledWith(connection.channel);
			await vi.waitFor(() => expect(connection.channel.subscribe).toHaveBeenCalledTimes(2));

			connection.status('SUBSCRIBED');
			expect(callbacks.onReconnect).toHaveBeenCalledTimes(1);
			callbacks.close();
		}
	});
});
