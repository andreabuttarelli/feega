import 'dart:convert';

import 'progress.dart';

const protocolVersion = 1;
const hostMessage = 'feega:host';
const playerMessage = 'feega:player';
const nativeBridge = 'FeegaHost';
const defaultOrigin = 'https://feega.app';
const embedRoute = '/e';

enum Fit { cover, contain }

enum HostCommand { play, pause, seek }

enum Playback {
  autoplay('autoplay'),
  inView('in-view'),
  scrub('scrub'),
  paused('paused');

  const Playback(this.wire);

  final String wire;

  static Playback of(Object? wire) => values.firstWhere((p) => p.wire == wire, orElse: () => autoplay);
}

const _visibilityCommands = <Playback, (HostCommand?, HostCommand?)>{
  Playback.autoplay: (HostCommand.play, HostCommand.pause),
  Playback.inView: (HostCommand.play, HostCommand.pause),
  Playback.scrub: (null, null),
  Playback.paused: (null, null),
};

HostCommand? visibilityCommand(Playback playback, {required bool visible}) {
  final (shown, hidden) = _visibilityCommands[playback]!;
  return visible ? shown : hidden;
}

Uri embedUri(String origin, String id, Fit fit) => Uri.parse('$origin$embedRoute/${Uri.encodeComponent(id)}?fit=${fit.name}');

class HostMessage {
  const HostMessage._(this._fields);

  HostMessage.progress(double progress, {required bool visible}) : this._({'progress': progress, 'visible': visible});
  HostMessage.visible(bool visible) : this._({'visible': visible});
  HostMessage.play() : this._({'command': HostCommand.play.name});
  HostMessage.pause() : this._({'command': HostCommand.pause.name});
  HostMessage.seek(double seconds) : this._({'command': HostCommand.seek.name, 'time': seconds});
  HostMessage.command(HostCommand command) : this._({'command': command.name});
  HostMessage.fit(Fit fit) : this._({'fit': fit.name});
  HostMessage.greet({required bool reducedMotion}) : this._({'links': 'host', 'reducedMotion': reducedMotion});
  HostMessage.tilt(Tilt tilt) : this._({'tilt': {'x': tilt.x, 'y': tilt.y}});

  final Map<String, Object?> _fields;

  Map<String, Object?> toJson() => {'type': hostMessage, ..._fields};

  String get script => "window.postMessage(${jsonEncode(toJson())}, '*');";
}

class ReadyInfo {
  const ReadyInfo({required this.width, required this.height, required this.duration, required this.playback, required this.loop});

  final double width;
  final double height;
  final double duration;
  final Playback playback;
  final bool loop;

  double get aspect => width / height;
}

sealed class PlayerMessage {
  const PlayerMessage();

  static PlayerMessage? parse(String raw) {
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return null;
    }
    if (decoded is! Map<String, dynamic> || decoded['type'] != playerMessage || decoded['v'] != protocolVersion) {
      return null;
    }
    return _readers[decoded['event']]?.call(decoded);
  }
}

class SizeMessage extends PlayerMessage {
  const SizeMessage(this.aspect);
  final double aspect;
}

class ReadyMessage extends PlayerMessage {
  const ReadyMessage(this.info);
  final ReadyInfo info;
}

class TimeMessage extends PlayerMessage {
  const TimeMessage(this.time, this.duration);
  final double time;
  final double duration;
}

class EndedMessage extends PlayerMessage {
  const EndedMessage();
}

class LinkMessage extends PlayerMessage {
  const LinkMessage(this.url);
  final Uri url;
}

class ErrorMessage extends PlayerMessage {
  const ErrorMessage(this.message);
  final String message;
}

double _num(Object? v) => v is num ? v.toDouble() : 0;

PlayerMessage? _link(Map<String, dynamic> m) {
  final url = Uri.tryParse('${m['url']}');
  return url != null && (url.isScheme('http') || url.isScheme('https')) ? LinkMessage(url) : null;
}

final Map<Object?, PlayerMessage? Function(Map<String, dynamic>)> _readers = {
  'size': (m) => SizeMessage(_num(m['aspect'])),
  'ready': (m) => ReadyMessage(ReadyInfo(width: _num(m['width']), height: _num(m['height']), duration: _num(m['duration']), playback: Playback.of(m['playback']), loop: m['loop'] == true)),
  'timeupdate': (m) => TimeMessage(_num(m['time']), _num(m['duration'])),
  'ended': (_) => const EndedMessage(),
  'link': _link,
  'error': (m) => ErrorMessage('${m['message']}'),
};
