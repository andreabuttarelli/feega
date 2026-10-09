import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as react from '../../../../packages/feega-motion-react/src/protocol';
import { EMBED_ROUTE, HOST_MESSAGE } from './host';
import { Fit } from './fit';
import { PlayMode } from './settings';
import { HostCommand, NATIVE_BRIDGE, PLAYER_MESSAGE, PROTOCOL_VERSION, PlayerEvent } from './protocol';

const dart = readFileSync(new URL('../../../../packages/feega_motion_flutter/lib/src/protocol.dart', import.meta.url), 'utf8');
const dartConst = (name: string) => new RegExp(`const ${name} = '?([^';]+)'?;`).exec(dart)?.[1];

describe('the SDKs speak the player protocol', () => {
  it('React uses the same names, version and enums as the player', () => {
    expect([react.PROTOCOL_VERSION, react.HOST_MESSAGE, react.PLAYER_MESSAGE, react.EMBED_ROUTE, react.SCRUB_PLAYBACK]).toEqual([PROTOCOL_VERSION, HOST_MESSAGE, PLAYER_MESSAGE, EMBED_ROUTE, PlayMode.Scrub]);
    expect({ ...react.PlayerEvent }).toEqual({ ...PlayerEvent });
    expect({ ...react.HostCommand }).toEqual({ ...HostCommand });
    expect({ ...react.Fit }).toEqual({ ...Fit });
  });

  it('Flutter uses the same names, version, bridge and playback names', () => {
    expect([dartConst('protocolVersion'), dartConst('hostMessage'), dartConst('playerMessage'), dartConst('nativeBridge'), dartConst('embedRoute')]).toEqual([String(PROTOCOL_VERSION), HOST_MESSAGE, PLAYER_MESSAGE, NATIVE_BRIDGE, EMBED_ROUTE]);
    for (const mode of Object.values(PlayMode)) {
      expect(dart).toContain(`('${mode}')`);
    }
    for (const event of Object.values(PlayerEvent)) {
      expect(dart).toContain(`'${event}': `);
    }
  });
});
