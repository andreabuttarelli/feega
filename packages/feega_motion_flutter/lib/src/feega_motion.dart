import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'progress.dart';
import 'protocol.dart';

const _tiltPlatforms = {TargetPlatform.android, TargetPlatform.iOS};

class FeegaMotionController {
  _FeegaMotionState? _state;

  void play() => _state?._send(HostMessage.play());

  void pause() => _state?._send(HostMessage.pause());

  void seek(double seconds) => _state?._send(HostMessage.seek(seconds));
}

class FeegaMotion extends StatefulWidget {
  const FeegaMotion({
    super.key,
    required this.id,
    this.fit = Fit.cover,
    this.scrollController,
    this.scrollLength,
    this.tilt = false,
    this.origin = defaultOrigin,
    this.controller,
    this.onReady,
    this.onTimeUpdate,
    this.onEnded,
    this.onLinkClick,
    this.onError,
  });

  final String id;
  final Fit fit;
  final ScrollController? scrollController;
  final int? scrollLength;
  final bool tilt;
  final String origin;
  final FeegaMotionController? controller;
  final ValueChanged<ReadyInfo>? onReady;
  final void Function(double time, double duration)? onTimeUpdate;
  final VoidCallback? onEnded;
  final ValueChanged<Uri>? onLinkClick;
  final ValueChanged<String>? onError;

  @override
  State<FeegaMotion> createState() => _FeegaMotionState();
}

class _FeegaMotionState extends State<FeegaMotion> with WidgetsBindingObserver {
  late final WebViewController _web;
  final List<HostMessage> _pending = [];
  ScrollPosition? _position;
  StreamSubscription<AccelerometerEvent>? _tilt;
  bool _listening = false;
  bool _measureQueued = false;
  bool _onScreen = false;
  bool _foreground = true;
  bool _shown = false;
  int _story = 0;
  double _stageTop = 0;
  double? _viewportHeight;
  double? _aspect;
  Playback? _playback;

  Uri get _embed => embedUri(widget.origin, widget.id, widget.fit);

  @override
  void initState() {
    super.initState();
    widget.controller?._state = this;
    WidgetsBinding.instance.addObserver(this);
    _story = widget.scrollLength ?? 0;
    widget.scrollController?.addListener(_queueMeasure);
    WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _measure() : null);
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(nativeBridge, onMessageReceived: (m) => _hear(m.message))
      ..setNavigationDelegate(NavigationDelegate(onNavigationRequest: _navigate))
      ..loadRequest(_embed);
    _transparent();
    if (widget.scrollLength == null) {
      _readSettings();
    }
    if (widget.tilt && _tiltPlatforms.contains(defaultTargetPlatform)) {
      _tilt = accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen(
        (e) => _shown ? _send(HostMessage.tilt(tiltOf(e.x, e.y, e.z))) : null,
        onError: (Object e) => debugPrint('feega_motion: tilt unavailable ($e)'),
        cancelOnError: true,
      );
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _position?.removeListener(_queueMeasure);
    _position = Scrollable.maybeOf(context)?.position;
    _position?.addListener(_queueMeasure);
  }

  @override
  void didUpdateWidget(FeegaMotion old) {
    super.didUpdateWidget(old);
    old.controller?._state = null;
    widget.controller?._state = this;
    if (old.fit != widget.fit) {
      _send(HostMessage.fit(widget.fit));
    }
    if (old.scrollController != widget.scrollController) {
      old.scrollController?.removeListener(_queueMeasure);
      widget.scrollController?.addListener(_queueMeasure);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _position?.removeListener(_queueMeasure);
    widget.scrollController?.removeListener(_queueMeasure);
    widget.controller?._state = null;
    _tilt?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _updateShown();
  }

  Future<void> _transparent() async {
    try {
      await _web.setBackgroundColor(const Color(0x00000000));
    } on UnimplementedError {
      return;
    }
  }

  Future<void> _readSettings() async {
    try {
      final request = await HttpClient().getUrl(Uri.parse('${widget.origin}$embedRoute/${Uri.encodeComponent(widget.id)}.json'));
      final response = await request.close();
      final body = jsonDecode(await response.transform(utf8.decoder).join()) as Map<String, dynamic>;
      if (!mounted || body['playback'] != Playback.scrub.wire) {
        return;
      }
      setState(() => _story = (body['scrollLength'] as num?)?.toInt() ?? 0);
    } on Object catch (e) {
      debugPrint('feega_motion: settings unavailable ($e)');
    }
  }

  NavigationDecision _navigate(NavigationRequest request) {
    if (!request.isMainFrame || request.url == _embed.toString()) {
      return NavigationDecision.navigate;
    }
    _openLink(Uri.parse(request.url));
    return NavigationDecision.prevent;
  }

  void _openLink(Uri url) {
    final handler = widget.onLinkClick;
    if (handler != null) {
      handler(url);
      return;
    }
    launchUrl(url, mode: LaunchMode.externalApplication);
  }

  void _send(HostMessage message) {
    if (!_listening) {
      _pending.add(message);
      return;
    }
    _web.runJavaScript(message.script);
  }

  void _hear(String raw) {
    final message = PlayerMessage.parse(raw);
    switch (message) {
      case SizeMessage(:final aspect):
        _listening = true;
        _send(HostMessage.greet(reducedMotion: MediaQuery.maybeDisableAnimationsOf(context) ?? false));
        _pending.toList().forEach(_send);
        _pending.clear();
        setState(() => _aspect = aspect);
        _measure();
      case ReadyMessage(:final info):
        _playback = info.playback;
        widget.onReady?.call(info);
      case TimeMessage(:final time, :final duration):
        widget.onTimeUpdate?.call(time, duration);
      case EndedMessage():
        widget.onEnded?.call();
      case LinkMessage(:final url):
        _openLink(url);
      case ErrorMessage(message: final text):
        widget.onError?.call(text);
      case null:
        return;
    }
  }

  void _updateShown() {
    final shown = _onScreen && _foreground;
    if (shown == _shown) {
      return;
    }
    _shown = shown;
    _send(HostMessage.visible(shown));
    final playback = _playback;
    final command = playback == null ? null : visibilityCommand(playback, visible: shown);
    if (command != null) {
      _send(HostMessage.command(command));
    }
  }

  void _queueMeasure() {
    if (_measureQueued) {
      return;
    }
    _measureQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _measureQueued = false;
      if (mounted) {
        _measure();
      }
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _measure() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) {
      return;
    }
    final scrollable = Scrollable.maybeOf(context)?.context.findRenderObject() as RenderBox?;
    final origin = scrollable?.localToGlobal(Offset.zero).dy ?? 0;
    final viewport = Span(top: 0, height: scrollable?.size.height ?? MediaQuery.sizeOf(context).height);
    final own = Span(top: box.localToGlobal(Offset.zero).dy - origin, height: box.size.height);
    final story = _story > 0;
    final progress = story ? storyProgress(own, viewport.height, viewport) : travelProgress(own, viewport);
    _send(HostMessage.progress(progress, visible: isVisible(own, viewport)));
    if (!story) {
      return;
    }
    final top = stageOffset(own, viewport.height, viewport);
    if (top != _stageTop || viewport.height != _viewportHeight) {
      setState(() {
        _stageTop = top;
        _viewportHeight = viewport.height;
      });
    }
  }

  void _visibility(VisibilityInfo info) {
    _onScreen = info.visibleFraction > 0;
    _updateShown();
  }

  Widget _player() => WebViewWidget(controller: _web);

  @override
  Widget build(BuildContext context) {
    return VisibilityDetector(
      key: ValueKey('feega-motion-${widget.id}'),
      onVisibilityChanged: _visibility,
      child: LayoutBuilder(builder: (context, constraints) {
        if (_story > 0) {
          final stage = _viewportHeight ?? MediaQuery.sizeOf(context).height;
          return SizedBox(
            height: _story * stage,
            child: Stack(children: [Positioned(top: _stageTop, left: 0, right: 0, height: stage, child: _player())]),
          );
        }
        if (constraints.hasBoundedHeight) {
          return SizedBox.expand(child: _player());
        }
        return AspectRatio(aspectRatio: _aspect ?? 16 / 9, child: _player());
      }),
    );
  }
}
