import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'native.dart';

final _boot = Stopwatch()..start();

class Ui {
  static const canvas = Color(0xFF121212);
  static const panel = Color(0xFF1F1F1F);
  static const input = Color(0xFF2C2C2C);
  static const text = Color(0xFFEDEDED);
  static const text2 = Color(0xFFA3A3A3);
  static const text3 = Color(0xFF737373);
  static const accent = Color(0xFF0099FF);
  static const mono = TextStyle(fontFamily: 'Menlo', fontSize: 11, color: text2, fontFeatures: [FontFeature.tabularFigures()]);
  static const label = TextStyle(fontSize: 12, color: text2);
  static const title = TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: text, letterSpacing: -0.13);
  static const caps = TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: text3, letterSpacing: 0.6);
}

void main() {
  _boot.elapsed;
  runApp(const SpikeApp());
}

class SpikeApp extends StatelessWidget {
  const SpikeApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(brightness: Brightness.dark, scaffoldBackgroundColor: Ui.canvas),
        home: const Editor(),
      );
}

enum Tool { select, hand }

class Camera {
  double zoom = 0.06;
  Offset pan = const Offset(40, 40);

  Offset toWorld(Offset screen) => (screen - pan) / zoom;

  void zoomAt(Offset focus, double factor) {
    final world = toWorld(focus);
    zoom = (zoom * factor).clamp(0.01, 16.0);
    pan = focus - world * zoom;
  }

  void centre(Offset world, Size view, double z) {
    zoom = z;
    pan = view.center(Offset.zero) - world * z;
  }
}

class Editor extends StatefulWidget {
  const Editor({super.key});

  @override
  State<Editor> createState() => _EditorState();
}

class _EditorState extends State<Editor> with SingleTickerProviderStateMixin {
  final camera = Camera();
  Engine? engine;
  SceneMeta? meta;
  Surface? surface;
  String status = 'Loading scene…';
  Tool tool = Tool.select;
  Frame? selected;
  bool playing = true;
  late final Ticker ticker;
  Duration now = Duration.zero;
  Duration? lastTick;
  Size view = Size.zero;
  double dpr = 2;
  bool creating = false;
  final intervals = <double>[];
  final renders = <double>[];
  double fps = 0;
  double renderMs = 0;
  Bench? bench;
  Map<String, num> boot = {};
  final rootKey = GlobalKey();
  bool recording = false;

  Rect get bounds => meta!.frames.map((f) => Rect.fromLTWH(f.x, f.y, f.w, f.h)).reduce((a, b) => a.expandToInclude(b));

  @override
  void initState() {
    super.initState();
    ticker = createTicker(_tick)..start();
    _load();
  }

  Future<void> _load() async {
    final path = scenePath();
    final sw = Stopwatch()..start();
    final results = await Future.wait([Engine.open(path), SceneMeta.load(path)]);
    engine = results[0] as Engine?;
    meta = results[1] as SceneMeta?;
    boot['loadMs'] = sw.elapsedMilliseconds;
    setState(() {
      status = engine == null ? 'Engine failed to load $path' : '${meta!.frames.length} uses · ${meta!.nodes} nodes';
      if (view != Size.zero) camera.centre(bounds.center, view, math.min(view.width / bounds.width, view.height / bounds.height) * 0.95);
    });
    _ensureSurface();
  }

  Future<void> _ensureSurface() async {
    final w = (view.width * dpr).round(), h = (view.height * dpr).round();
    if (engine == null || creating || w <= 0 || h <= 0) return;
    if (surface != null && surface!.width == w && surface!.height == h) return;
    creating = true;
    final next = await Surface.create(w, h);
    creating = false;
    if (next == null || !engine!.attach(next.address, w, h)) return;
    final old = surface;
    setState(() => surface = next);
    old?.dispose();
    _ensureSurface();
  }

  void _tick(Duration elapsed) {
    if (lastTick != null) intervals.add((elapsed - lastTick!).inMicroseconds / 1000);
    lastTick = elapsed;
    if (recording) return;
    if (playing) now = elapsed;
    bench?.step(elapsed, this);
    _paint();
    if (intervals.length >= 30) {
      final avg = intervals.reduce((a, b) => a + b) / intervals.length;
      final r = renders.isEmpty ? 0.0 : renders.reduce((a, b) => a + b) / renders.length;
      intervals.clear();
      renders.clear();
      setState(() {
        fps = 1000 / avg;
        renderMs = r;
      });
    }
  }

  void _paint() {
    final s = surface, e = engine;
    if (s == null || e == null) return;
    final z = camera.zoom * dpr;
    final ms = e.render([z, 0, 0, z, camera.pan.dx * dpr, camera.pan.dy * dpr], now.inMicroseconds / 1000);
    if (ms < 0) return;
    renders.add(ms);
    bench?.rendered(ms);
    s.presented();
    if (!boot.containsKey('firstFrameMs')) {
      boot['firstFrameMs'] = _boot.elapsedMilliseconds;
      boot['firstFrameEpochMs'] = DateTime.now().millisecondsSinceEpoch;
      if (Platform.environment['FEEGA_BENCH'] == '1') Future.delayed(const Duration(seconds: 2), startBench);
      final rec = Platform.environment['FEEGA_RECORD'];
      if (rec != null) Future.delayed(const Duration(seconds: 2), () => record(rec));
    }
  }

  Future<void> snap(String path) async {
    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    final boundary = rootKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: dpr);
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    File(path).writeAsBytesSync(png!.buffer.asUint8List());
  }

  Future<void> record(String dir) async {
    recording = true;
    final l = Bench._first(this, 'landing');
    for (final z in [0.25, 1.0, 4.0]) {
      setState(() => camera.centre(Offset(l.x + l.w / 2, l.y + 260), view, z));
      _paint();
      await snap('$dir/zoom-$z.png');
    }
    setState(() => selected = l);
    await snap('$dir/ui.png');
    setState(() => selected = null);
    Directory('$dir/frames').createSync(recursive: true);
    const fps = 30;
    for (var i = 0; i < fps * 12; i++) {
      final t = i / fps;
      now = Duration(microseconds: (t * 1e6).round());
      setState(() => (t < 6 ? Bench.phases[1].$3(t, this) : Bench.phases[2].$3(t - 6, this)));
      _paint();
      await snap('$dir/frames/${i.toString().padLeft(4, '0')}.png');
    }
    recording = false;
    exit(0);
  }

  void startBench() => setState(() => bench = Bench(onDone: _benchDone));

  void _benchDone(Map<String, dynamic> result) {
    result['boot'] = boot;
    result['canvasPx'] = [surface?.width, surface?.height];
    result['dpr'] = dpr;
    final out = Platform.environment['FEEGA_OUT'];
    if (out != null) File('$out/results.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert(result));
    setState(() {
      bench = null;
      status = 'Bench: ${(result['phases'] as List).map((p) => '${p['name']} ${(p['fps'] as double).toStringAsFixed(0)}').join(' · ')} fps';
    });
  }

  Frame? _hit(Offset screen) {
    final w = camera.toWorld(screen);
    for (final f in (meta?.frames ?? const <Frame>[]).reversed) {
      if (!f.moving && Rect.fromLTWH(f.x, f.y, f.w, f.h).contains(w)) return f;
    }
    return null;
  }

  void _focus(Frame f) {
    final z = math.min(view.width / f.w, view.height / f.h) * 0.85;
    setState(() {
      selected = f;
      camera.centre(Offset(f.x + f.w / 2, f.y + f.h / 2), view, z);
    });
  }

  void _onSignal(PointerSignalEvent e) {
    if (e is! PointerScrollEvent) return;
    final zooming = HardwareKeyboard.instance.isMetaPressed || HardwareKeyboard.instance.isControlPressed;
    setState(() {
      if (zooming) {
        camera.zoomAt(e.localPosition, math.exp(-e.scrollDelta.dy / 300));
      } else {
        camera.pan -= e.scrollDelta;
      }
    });
  }

  Offset? dragStart;
  Offset? frameStart;

  void _onDown(PointerDownEvent e) {
    dragStart = e.localPosition;
    final f = tool == Tool.select ? _hit(e.localPosition) : null;
    setState(() => selected = f);
    frameStart = f == null ? null : Offset(f.x, f.y);
  }

  void _onMove(PointerMoveEvent e) {
    final f = selected;
    setState(() {
      if (tool == Tool.select && f != null && frameStart != null) {
        final d = (e.localPosition - dragStart!) / camera.zoom;
        f.x = frameStart!.dx + d.dx;
        f.y = frameStart!.dy + d.dy;
        engine?.move(f.index, f.x, f.y);
      } else {
        camera.pan += e.delta;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    dpr = MediaQuery.devicePixelRatioOf(context);
    return RepaintBoundary(key: rootKey, child: Scaffold(
      body: Column(children: [
        _toolbar(),
        Expanded(
          child: Row(children: [
            SizedBox(width: 240, child: _layers()),
            Expanded(child: _canvas()),
            SizedBox(width: 260, child: _properties()),
          ]),
        ),
      ]),
    ));
  }

  Widget _toolbar() => Container(
        height: 44,
        color: Ui.panel,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(children: [
          const Text('feega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Ui.text)),
          const SizedBox(width: 16),
          _toolButton(Icons.near_me_outlined, Tool.select, 'Select'),
          _toolButton(Icons.pan_tool_outlined, Tool.hand, 'Hand'),
          const SizedBox(width: 8),
          _iconButton(playing ? Icons.pause : Icons.play_arrow, playing ? 'Pause motion' : 'Play motion', () => setState(() => playing = !playing)),
          _iconButton(Icons.speed, 'Run bench', startBench),
          const Spacer(),
          Flexible(child: Text(status, style: Ui.label, overflow: TextOverflow.ellipsis)),
          const SizedBox(width: 16),
          Text('${fps.toStringAsFixed(0)} fps · ${renderMs.toStringAsFixed(1)} ms · ${(camera.zoom * 100).round()}%', style: Ui.mono),
        ]),
      );

  Widget _toolButton(IconData icon, Tool t, String tip) => Padding(
        padding: const EdgeInsets.only(right: 4),
        child: Tooltip(
          message: tip,
          child: InkWell(
            borderRadius: BorderRadius.circular(4),
            onTap: () => setState(() => tool = t),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(color: tool == t ? Ui.accent : Colors.transparent, borderRadius: BorderRadius.circular(4)),
              child: Icon(icon, size: 16, color: tool == t ? Colors.white : Ui.text2),
            ),
          ),
        ),
      );

  Widget _iconButton(IconData icon, String tip, VoidCallback onTap) => Tooltip(
        message: tip,
        child: InkWell(borderRadius: BorderRadius.circular(4), onTap: onTap, child: SizedBox(width: 28, height: 28, child: Icon(icon, size: 16, color: Ui.text2))),
      );

  Widget _layers() {
    final frames = meta?.frames.where((f) => !f.moving).toList() ?? const <Frame>[];
    return Container(
      color: Ui.panel,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(padding: EdgeInsets.fromLTRB(12, 12, 12, 8), child: Text('Layers', style: Ui.title)),
        const Padding(padding: EdgeInsets.fromLTRB(12, 4, 12, 6), child: Text('FRAMES', style: Ui.caps)),
        Expanded(
          child: ListView.builder(
            itemCount: frames.length,
            itemExtent: 28,
            itemBuilder: (_, i) {
              final f = frames[i], on = f == selected;
              return InkWell(
                onTap: () => _focus(f),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(color: on ? Ui.accent.withValues(alpha: 0.16) : null, borderRadius: BorderRadius.circular(4)),
                  child: Row(children: [
                    Icon(Icons.crop_free, size: 14, color: on ? Ui.accent : Ui.text3),
                    const SizedBox(width: 8),
                    Expanded(child: Text(f.name, style: Ui.label.copyWith(color: on ? Ui.accent : Ui.text), overflow: TextOverflow.ellipsis)),
                    Text('${f.items}', style: Ui.mono.copyWith(color: Ui.text3)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  Widget _properties() {
    final f = selected;
    Widget field(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
          child: Row(children: [
            SizedBox(width: 64, child: Text(k, style: Ui.label)),
            Expanded(
              child: Container(
                height: 28,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(color: Ui.input, borderRadius: BorderRadius.circular(4)),
                child: Text(v, style: Ui.mono.copyWith(color: Ui.text), overflow: TextOverflow.ellipsis),
              ),
            ),
          ]),
        );
    return Container(
      color: Ui.panel,
      child: ListView(children: [
        const Padding(padding: EdgeInsets.fromLTRB(12, 12, 12, 8), child: Text('Properties', style: Ui.title)),
        if (f == null) const Padding(padding: EdgeInsets.all(12), child: Text('Select a frame', style: TextStyle(fontSize: 11, color: Ui.text3))),
        if (f != null) ...[
          const Padding(padding: EdgeInsets.fromLTRB(12, 8, 12, 6), child: Text('FRAME', style: Ui.caps)),
          field('Name', f.name),
          field('X', f.x.toStringAsFixed(0)),
          field('Y', f.y.toStringAsFixed(0)),
          field('W', f.w.toStringAsFixed(0)),
          field('H', f.h.toStringAsFixed(0)),
          field('Nodes', '${f.items}'),
        ],
        const Padding(padding: EdgeInsets.fromLTRB(12, 16, 12, 6), child: Text('RENDERER', style: Ui.caps)),
        field('Engine', 'gpu-core · vello'),
        field('Backend', 'wgpu → Metal'),
        field('Canvas', surface == null ? '—' : '${surface!.width}×${surface!.height}'),
        field('Boot', boot['firstFrameMs'] == null ? '—' : '${boot['firstFrameMs']} ms'),
      ]),
    );
  }

  Widget _canvas() => LayoutBuilder(builder: (context, c) {
        if (c.biggest != view) {
          final first = view == Size.zero;
          view = c.biggest;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (first && meta != null) camera.centre(bounds.center, view, math.min(view.width / bounds.width, view.height / bounds.height) * 0.95);
            _ensureSurface();
          });
        }
        return ClipRect(
          child: Listener(
            onPointerSignal: _onSignal,
            onPointerDown: _onDown,
            onPointerMove: _onMove,
            onPointerPanZoomUpdate: (e) => setState(() {
              camera.pan += e.panDelta;
              if (e.scale != 1) camera.zoomAt(e.localPosition, 1 + (e.scale - 1) * 0.15);
            }),
            child: MouseRegion(
              cursor: tool == Tool.hand ? SystemMouseCursors.grab : SystemMouseCursors.basic,
              child: Stack(fit: StackFit.expand, children: [
                if (surface != null) Texture(textureId: surface!.id, filterQuality: FilterQuality.none),
                if (surface == null) Center(child: Text(status, style: Ui.label)),
                CustomPaint(painter: _Selection(selected, camera.zoom, camera.pan)),
              ]),
            ),
          ),
        );
      });

  @override
  void dispose() {
    ticker.dispose();
    surface?.dispose();
    super.dispose();
  }
}

class _Selection extends CustomPainter {
  _Selection(this.frame, this.zoom, this.pan) : x = frame?.x, y = frame?.y;
  final Frame? frame;
  final double zoom;
  final Offset pan;
  final double? x;
  final double? y;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame;
    if (f == null) return;
    final r = Rect.fromLTWH(f.x * zoom + pan.dx, f.y * zoom + pan.dy, f.w * zoom, f.h * zoom);
    canvas.drawRect(r, Paint()
      ..color = Ui.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5);
    final tp = TextPainter(text: TextSpan(text: '${f.name}  ${f.w.round()}×${f.h.round()}', style: const TextStyle(fontSize: 11, color: Ui.accent)), textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, r.topLeft - Offset(0, tp.height + 4));
  }

  @override
  bool shouldRepaint(_Selection old) => old.frame != frame || old.zoom != zoom || old.pan != pan || old.x != x || old.y != y;
}

typedef Drive = void Function(double t, _EditorState s);

class Bench {
  Bench({required this.onDone}) {
    SchedulerBinding.instance.addTimingsCallback(_timings);
  }

  final void Function(Map<String, dynamic>) onDone;
  Duration? phaseStart;
  Duration? last;
  int index = 0;
  final ticks = <double>[];
  final renderMs = <double>[];
  final raster = <double>[];
  final results = <Map<String, dynamic>>[];

  static Frame _first(_EditorState s, String prefix) => s.meta!.frames.firstWhere((f) => f.name.startsWith(prefix));

  static final phases = <(String, double, Drive)>[
    ('overview', 2, (t, s) => s.camera.centre(s.bounds.center, s.view, math.min(s.view.width / s.bounds.width, s.view.height / s.bounds.height))),
    ('pan', 10, (t, s) {
      final l = _first(s, 'landing');
      s.camera.centre(Offset(l.x + 3000 + 1600 * math.sin(2 * math.pi * t / 4), l.y + 2000 + 900 * math.sin(2 * math.pi * t / 6)), s.view, 0.25);
    }),
    ('zoom', 10, (t, s) {
      final l = _first(s, 'landing');
      s.camera.centre(Offset(l.x + l.w / 2, l.y + 500), s.view, 0.05 * math.pow(80, (1 - math.cos(2 * math.pi * t / 5)) / 2));
    }),
    ('motion', 5, (t, s) {
      final m = _first(s, 'motion');
      s.camera.centre(Offset(m.x + m.w / 2, m.y + m.h / 2), s.view, 0.5);
    }),
  ];

  void _timings(List<ui.FrameTiming> t) => raster.addAll(t.map((f) => f.rasterDuration.inMicroseconds / 1000));

  void rendered(double ms) => renderMs.add(ms);

  void step(Duration now, _EditorState s) {
    phaseStart ??= now;
    if (last != null) ticks.add((now - last!).inMicroseconds / 1000);
    last = now;
    final t = (now - phaseStart!).inMicroseconds / 1e6;
    final (name, seconds, _) = phases[index];
    if (t >= seconds) {
      results.add(_summary(name, t));
      ticks.clear();
      renderMs.clear();
      raster.clear();
      phaseStart = now;
      index++;
      if (index == phases.length) {
        SchedulerBinding.instance.removeTimingsCallback(_timings);
        onDone({'phases': results});
        return;
      }
    }
    phases[index].$3(t >= seconds ? 0 : t, s);
  }

  static double _pct(List<double> v, double p) {
    if (v.isEmpty) return 0;
    final s = [...v]..sort();
    return s[math.min(s.length - 1, (s.length * p).floor())];
  }

  Map<String, dynamic> _summary(String name, double seconds) => {
        'name': name,
        'seconds': seconds,
        'frames': ticks.length,
        'fps': ticks.length / seconds,
        'intervalP50': _pct(ticks, 0.5),
        'intervalP95': _pct(ticks, 0.95),
        'intervalMax': _pct(ticks, 1),
        'over16ms': ticks.where((t) => t > 16.7).length / math.max(1, ticks.length),
        'renderP50': _pct(renderMs, 0.5),
        'renderP95': _pct(renderMs, 0.95),
        'rasterP50': _pct(raster, 0.5),
        'rasterP95': _pct(raster, 0.95),
      };
}
