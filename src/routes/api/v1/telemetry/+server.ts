import type { RequestHandler } from './$types';
import { handleUsage } from '$lib/server/telemetry/usage';
import { dbSink } from '$lib/server/telemetry/usage-db';

export const POST: RequestHandler = ({ request, getClientAddress }) => handleUsage(request, getClientAddress(), dbSink);
