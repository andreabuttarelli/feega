import 'package:feega_motion/feega_motion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

const _screen = Size(400, 600);
const _intro = 300.0;
const _story = 3;

class _FakeController extends PlatformWebViewController {
  _FakeController(super.params) : super.implementation();

  final List<String> scripts = [];

  @override
  Future<void> setJavaScriptMode(JavaScriptMode mode) async {}

  @override
  Future<void> addJavaScriptChannel(JavaScriptChannelParams params) async {}

  @override
  Future<void> setPlatformNavigationDelegate(PlatformNavigationDelegate handler) async {}

  @override
  Future<void> loadRequest(LoadRequestParams params) async {}

  @override
  Future<void> setBackgroundColor(Color color) async {}

  @override
  Future<void> runJavaScript(String javaScript) async => scripts.add(javaScript);
}

class _FakeDelegate extends PlatformNavigationDelegate {
  _FakeDelegate(super.params) : super.implementation();

  @override
  Future<void> setOnNavigationRequest(NavigationRequestCallback onNavigationRequest) async {}
}

class _FakeWidget extends PlatformWebViewWidget {
  _FakeWidget(super.params) : super.implementation();

  @override
  Widget build(BuildContext context) => ColoredBox(key: const Key('player'), color: const Color(0xFF000000));
}

class _FakePlatform extends WebViewPlatform {
  @override
  PlatformWebViewController createPlatformWebViewController(PlatformWebViewControllerCreationParams params) => _FakeController(params);

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(PlatformNavigationDelegateCreationParams params) => _FakeDelegate(params);

  @override
  PlatformWebViewWidget createPlatformWebViewWidget(PlatformWebViewWidgetCreationParams params) => _FakeWidget(params);
}

Future<ScrollController> _pumpStory(WidgetTester tester) async {
  tester.view.physicalSize = _screen;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final scroll = ScrollController();
  addTearDown(scroll.dispose);
  await tester.pumpWidget(MaterialApp(
    home: ListView(controller: scroll, children: [
      const SizedBox(height: _intro),
      const FeegaMotion(id: 'story', scrollLength: _story),
      SizedBox(height: _screen.height),
    ]),
  ));
  await tester.pump();
  return scroll;
}

void main() {
  setUp(() {
    WebViewPlatform.instance = _FakePlatform();
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });

  testWidgets('the stage stays pinned in the very frame the page scrolls', (tester) async {
    final scroll = await _pumpStory(tester);

    for (final offset in [_intro + 100, _intro + 450, _intro + 900]) {
      scroll.jumpTo(offset);
      await tester.pump();
      expect(tester.getTopLeft(find.byKey(const Key('player'))).dy, 0, reason: 'scrolled to $offset');
    }
  });

  testWidgets('scrolling the story does not rebuild the player', (tester) async {
    final scroll = await _pumpStory(tester);
    var builds = 0;
    final element = tester.element(find.byKey(const Key('player')));
    final widget = element.widget;

    for (var offset = _intro; offset < _intro + 900; offset += 30) {
      scroll.jumpTo(offset);
      await tester.pump();
      if (!identical(tester.element(find.byKey(const Key('player'))).widget, widget)) {
        builds += 1;
      }
    }
    expect(builds, 0);
  });
}
