import 'package:feega_motion_example/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

final _status = RegExp(r'^(\S+).* · ([\d.]+)s$');

String _statusText(WidgetTester tester) => tester.widgetList<Text>(find.byType(Text)).map((t) => t.data ?? '').firstWhere(_status.hasMatch);

Future<void> _until(WidgetTester tester, bool Function() done, {Duration timeout = const Duration(seconds: 90)}) async {
  final end = DateTime.now().add(timeout);
  while (!done()) {
    if (DateTime.now().isAfter(end)) {
      fail('timed out; last status: ${_statusText(tester)}');
    }
    await tester.pump(const Duration(milliseconds: 250));
  }
}

double _time(WidgetTester tester) => double.parse(_status.firstMatch(_statusText(tester))!.group(2)!);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the Saturn embed gets ready in a native WebView and scrolling the page scrubs it', (tester) async {
    await tester.pumpWidget(const ExampleApp());
    await _until(tester, () => _statusText(tester).startsWith('ready'));
    expect(_statusText(tester), contains('scrub'));

    final position = tester.state<ScrollableState>(find.byType(Scrollable).first).position;
    final screen = tester.view.physicalSize.height / tester.view.devicePixelRatio;

    position.jumpTo(screen * 0.7 + screen * 0.5);
    await _until(tester, () => _time(tester) > 0);
    final middle = _time(tester);

    position.jumpTo(screen * 0.7 + screen * 1.9);
    await _until(tester, () => _time(tester) > middle);

    expect(_time(tester), greaterThan(middle));
  });
}
