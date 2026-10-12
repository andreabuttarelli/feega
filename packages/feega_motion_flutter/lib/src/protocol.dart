import 'dart:convert';

import 'progress.dart';

const protocolVersion = 1;
const hostMessage = 'feega:host';
const playerMessage = 'feega:player';
const nativeBridge = 'FeegaHost';
const defaultOrigin = 'https://oh.feega.app';
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

enum VarKind {
  number('number'),
  boolean('boolean'),
  enumeration('enum'),
  color('color'),
  string('string');

  const VarKind(this.wire);

  final String wire;

  static VarKind? of(Object? wire) => values.where((k) => k.wire == wire).firstOrNull;
}

class VarDecl {
  const VarDecl({required this.name, required this.kind, required this.defaultValue, this.min, this.max, this.options = const []});

  final String name;
  final VarKind kind;
  final Object? defaultValue;
  final double? min;
  final double? max;
  final List<String> options;

  static VarDecl? fromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) {
      return null;
    }
    final kind = VarKind.of(raw['kind']);
    final name = raw['name'];
    if (kind == null || name is! String) {
      return null;
    }
    final options = raw['options'];
    return VarDecl(
      name: name,
      kind: kind,
      defaultValue: raw['default'],
      min: (raw['min'] as num?)?.toDouble(),
      max: (raw['max'] as num?)?.toDouble(),
      options: options is List ? options.whereType<String>().toList() : const [],
    );
  }
}

Map<String, Object?>? changedVars(Map<String, Object?> sent, Map<String, Object?> next) {
  final changed = {for (final e in next.entries) if (sent[e.key] != e.value) e.key: e.value};
  return changed.isEmpty ? null : changed;
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
  HostMessage.vars(Map<String, Object?> vars) : this._({'vars': vars});

  final Map<String, Object?> _fields;

  Map<String, Object?> toJson() => {'type': hostMessage, ..._fields};

  String get script => "window.postMessage(${jsonEncode(toJson())}, '*');";
}

class ReadyInfo {
  const ReadyInfo({required this.width, required this.height, required this.duration, required this.playback, required this.loop, this.vars = const [], this.values = const {}});

  final double width;
  final double height;
  final double duration;
  final Playback playback;
  final bool loop;
  final List<VarDecl> vars;
  final Map<String, Object?> values;

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

class VarsMessage extends PlayerMessage {
  const VarsMessage(this.values);
  final Map<String, Object?> values;
}

class ErrorMessage extends PlayerMessage {
  const ErrorMessage(this.message);
  final String message;
}

double _num(Object? v) => v is num ? v.toDouble() : 0;

Map<String, Object?> _values(Object? v) => v is Map<String, dynamic> ? Map<String, Object?>.from(v) : const {};

List<VarDecl> _decls(Object? v) => v is List ? v.map(VarDecl.fromJson).whereType<VarDecl>().toList() : const [];

PlayerMessage? _link(Map<String, dynamic> m) {
  final url = Uri.tryParse('${m['url']}');
  return url != null && (url.isScheme('http') || url.isScheme('https')) ? LinkMessage(url) : null;
}

final Map<Object?, PlayerMessage? Function(Map<String, dynamic>)> _readers = {
  'size': (m) => SizeMessage(_num(m['aspect'])),
  'ready': (m) => ReadyMessage(ReadyInfo(width: _num(m['width']), height: _num(m['height']), duration: _num(m['duration']), playback: Playback.of(m['playback']), loop: m['loop'] == true, vars: _decls(m['vars']), values: _values(m['values']))),
  'timeupdate': (m) => TimeMessage(_num(m['time']), _num(m['duration'])),
  'ended': (_) => const EndedMessage(),
  'link': _link,
  'error': (m) => ErrorMessage('${m['message']}'),
  'vars': (m) => VarsMessage(_values(m['values'])),
};
