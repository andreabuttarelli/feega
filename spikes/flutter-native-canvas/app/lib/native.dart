import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'dart:isolate';

import 'package:ffi/ffi.dart';
import 'package:flutter/services.dart';

typedef _NewC = Pointer<Void> Function(Pointer<Utf8>);
typedef _AttachC = Int32 Function(Pointer<Void>, Pointer<Void>, Uint32, Uint32);
typedef _AttachD = int Function(Pointer<Void>, Pointer<Void>, int, int);
typedef _RenderC = Double Function(Pointer<Void>, Double, Double, Double, Double, Double, Double, Double);
typedef _RenderD = double Function(Pointer<Void>, double, double, double, double, double, double, double);
typedef _MoveC = Void Function(Pointer<Void>, Uint32, Double, Double);
typedef _MoveD = void Function(Pointer<Void>, int, double, double);

const _lib = 'libfeega_canvas_native.dylib';

String _libraryPath() {
  final exe = File(Platform.resolvedExecutable).parent;
  final bundled = '${exe.parent.path}/Frameworks/$_lib';
  if (File(bundled).existsSync()) return bundled;
  return Platform.environment['FEEGA_NATIVE_LIB'] ?? _lib;
}

String scenePath() {
  final fromEnv = Platform.environment['FEEGA_SCENE'];
  if (fromEnv != null) return fromEnv;
  final exe = File(Platform.resolvedExecutable).parent;
  return '${exe.parent.path}/Resources/scene/scene.json';
}

class Engine {
  Engine._(this._ptr, this._attach, this._render, this._move);

  final Pointer<Void> _ptr;
  final _AttachD _attach;
  final _RenderD _render;
  final _MoveD _move;

  static Future<Engine?> open(String scene) async {
    final address = await Isolate.run(() {
      final create = DynamicLibrary.open(_libraryPath()).lookupFunction<_NewC, _NewC>('fc_new');
      final path = scene.toNativeUtf8();
      final ptr = create(path);
      malloc.free(path);
      return ptr.address;
    });
    if (address == 0) return null;
    final lib = DynamicLibrary.open(_libraryPath());
    return Engine._(Pointer.fromAddress(address), lib.lookupFunction<_AttachC, _AttachD>('fc_attach'), lib.lookupFunction<_RenderC, _RenderD>('fc_render'), lib.lookupFunction<_MoveC, _MoveD>('fc_move'));
  }

  bool attach(int surface, int width, int height) => _attach(_ptr, Pointer.fromAddress(surface), width, height) == 0;

  double render(List<double> m, double tMs) => _render(_ptr, m[0], m[1], m[2], m[3], m[4], m[5], tMs);

  void move(int index, double x, double y) => _move(_ptr, index, x, y);
}

class Surface {
  Surface(this.id, this.address, this.width, this.height);
  final int id;
  final int address;
  final int width;
  final int height;

  static const _channel = MethodChannel('feega/canvas');

  static Future<Surface?> create(int width, int height) async {
    final r = await _channel.invokeMapMethod<String, dynamic>('create', {'width': width, 'height': height});
    if (r == null) return null;
    return Surface(r['id'] as int, r['surface'] as int, width, height);
  }

  void presented() => _channel.invokeMethod('frame', {'id': id});

  void dispose() => _channel.invokeMethod('dispose', {'id': id});
}

class Frame {
  Frame(this.index, this.name, this.x, this.y, this.w, this.h, this.items, this.moving);
  final int index;
  final String name;
  double x;
  double y;
  final double w;
  final double h;
  final int items;
  final bool moving;
}

class SceneMeta {
  SceneMeta(this.frames, this.nodes);
  final List<Frame> frames;
  final int nodes;

  static Future<SceneMeta> load(String path) => Isolate.run(() {
        final doc = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
        final groups = doc['groups'] as Map<String, dynamic>;
        final moving = {for (final m in (doc['motion'] as List? ?? [])) (m as Map)['clip'] as String};
        final uses = doc['uses'] as List;
        final frames = <Frame>[];
        for (var i = 0; i < uses.length; i++) {
          final u = uses[i] as Map<String, dynamic>;
          final g = groups[u['group']] as Map<String, dynamic>;
          final m = (u['matrix'] as List).cast<num>();
          frames.add(Frame(i, u['group'] as String, m[4].toDouble(), m[5].toDouble(), (g['width'] as num).toDouble(), (g['height'] as num).toDouble(), (g['items'] as List).length, moving.contains(u['clip'])));
        }
        return SceneMeta(frames, (doc['nodes'] as num?)?.toInt() ?? 0);
      });
}
