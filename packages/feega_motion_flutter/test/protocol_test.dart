import 'dart:convert';

import 'package:feega_motion/feega_motion.dart';
import 'package:flutter_test/flutter_test.dart';

String player(Map<String, Object?> m) => jsonEncode({'type': playerMessage, 'v': protocolVersion, ...m});

void main() {
  group('reading the player', () {
    test('parses ready with its facts', () {
      final m = PlayerMessage.parse(player({'event': 'ready', 'width': 1920, 'height': 1080, 'duration': 8.5, 'playback': 'scrub', 'loop': false}));
      expect(m, isA<ReadyMessage>());
      final ready = m as ReadyMessage;
      expect(ready.info.duration, 8.5);
      expect(ready.info.playback, Playback.scrub);
      expect(ready.info.aspect, 1920 / 1080);
    });

    test('parses time, end, link, size and error', () {
      expect((PlayerMessage.parse(player({'event': 'timeupdate', 'time': 2, 'duration': 8})) as TimeMessage).time, 2);
      expect(PlayerMessage.parse(player({'event': 'ended'})), isA<EndedMessage>());
      expect((PlayerMessage.parse(player({'event': 'link', 'url': 'https://feega.app/'})) as LinkMessage).url, Uri.parse('https://feega.app/'));
      expect((PlayerMessage.parse(player({'event': 'size', 'width': 16, 'height': 9, 'aspect': 16 / 9})) as SizeMessage).aspect, 16 / 9);
      expect((PlayerMessage.parse(player({'event': 'error', 'message': 'boom'})) as ErrorMessage).message, 'boom');
    });

    test('ignores what is not the player, another version, or not json', () {
      expect(PlayerMessage.parse(jsonEncode({'type': 'other', 'v': 1, 'event': 'ended'})), isNull);
      expect(PlayerMessage.parse(jsonEncode({'type': playerMessage, 'v': 99, 'event': 'ended'})), isNull);
      expect(PlayerMessage.parse(player({'event': 'dance'})), isNull);
      expect(PlayerMessage.parse('not json'), isNull);
    });

    test('refuses a link that is not http', () {
      expect(PlayerMessage.parse(player({'event': 'link', 'url': 'javascript:alert(1)'})), isNull);
    });
  });

  group('speaking to the player', () {
    test('wraps every message in the host type', () {
      expect(HostMessage.progress(0.25, visible: true).toJson(), {'type': hostMessage, 'progress': 0.25, 'visible': true});
      expect(HostMessage.seek(1.5).toJson(), {'type': hostMessage, 'command': 'seek', 'time': 1.5});
      expect(HostMessage.greet(reducedMotion: true).toJson(), {'type': hostMessage, 'links': 'host', 'reducedMotion': true});
      expect(HostMessage.fit(Fit.contain).toJson(), {'type': hostMessage, 'fit': 'contain'});
      expect(HostMessage.tilt(const Tilt(0.5, -0.25)).toJson(), {
        'type': hostMessage,
        'tilt': {'x': 0.5, 'y': -0.25}
      });
    });

    test('posts itself as a window message the player hears', () {
      expect(HostMessage.play().script, "window.postMessage({\"type\":\"$hostMessage\",\"command\":\"play\"}, '*');");
    });

    test('pauses a playing video off-screen and resumes it in view, leaving scrub and paused alone', () {
      expect(visibilityCommand(Playback.autoplay, visible: false), HostCommand.pause);
      expect(visibilityCommand(Playback.inView, visible: true), HostCommand.play);
      expect(visibilityCommand(Playback.scrub, visible: false), isNull);
      expect(visibilityCommand(Playback.paused, visible: true), isNull);
    });
  });

  group('runtime variables', () {
    test('ready carries the schema and the values', () {
      final m = PlayerMessage.parse(player({
        'event': 'ready',
        'width': 16,
        'height': 9,
        'duration': 4,
        'playback': 'autoplay',
        'loop': true,
        'vars': [
          {'name': 'speed', 'kind': 'number', 'default': 1, 'min': 0, 'max': 4},
          {'name': 'mood', 'kind': 'enum', 'default': 'calm', 'options': ['calm', 'loud']},
          {'name': 'odd', 'kind': 'dance', 'default': 1}
        ],
        'values': {'speed': 1, 'mood': 'calm'}
      })) as ReadyMessage;

      expect(m.info.vars.map((v) => v.name), ['speed', 'mood']);
      expect(m.info.vars.first.kind, VarKind.number);
      expect(m.info.vars.first.max, 4);
      expect(m.info.vars.last.options, ['calm', 'loud']);
      expect(m.info.values, {'speed': 1, 'mood': 'calm'});
    });

    test('parses the values the player kept', () {
      expect((PlayerMessage.parse(player({'event': 'vars', 'values': {'speed': 4}})) as VarsMessage).values, {'speed': 4});
    });

    test('sends a partial update', () {
      expect(HostMessage.vars({'speed': 2}).toJson(), {
        'type': hostMessage,
        'vars': {'speed': 2}
      });
    });

    test('keeps only what changed', () {
      expect(changedVars({'speed': 1, 'label': 'Hi'}, {'speed': 2, 'label': 'Hi'}), {'speed': 2});
      expect(changedVars({'speed': 1}, {'speed': 1}), isNull);
    });
  });

  test('embed url carries the fit', () {
    expect(embedUri('https://feega.app', 'abc', Fit.cover).toString(), 'https://feega.app/e/abc?fit=cover');
  });

  test('default origin is the embed host, not the homepage', () {
    expect(defaultOrigin, 'https://oh.feega.app');
  });
}
