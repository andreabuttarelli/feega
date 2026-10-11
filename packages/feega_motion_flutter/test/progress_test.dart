import 'package:feega_motion/feega_motion.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const viewport = Span(top: 0, height: 1000);

  group('travel progress', () {
    test('is 0 when the embed enters at the bottom and 1 when it leaves at the top', () {
      expect(travelProgress(const Span(top: 1000, height: 500), viewport), 0);
      expect(travelProgress(const Span(top: 250, height: 500), viewport), 0.5);
      expect(travelProgress(const Span(top: -500, height: 500), viewport), 1);
    });

    test('is measured against the viewport it is given', () {
      expect(travelProgress(const Span(top: 200, height: 200), const Span(top: 100, height: 400)), 0.5);
    });
  });

  group('story progress', () {
    test('runs 0..1 while the story scrolls past its stage', () {
      expect(storyProgress(const Span(top: 0, height: 3000), 1000, viewport), 0);
      expect(storyProgress(const Span(top: -1000, height: 3000), 1000, viewport), 0.5);
      expect(storyProgress(const Span(top: -5000, height: 3000), 1000, viewport), 1);
    });

    test('pins the stage inside the story', () {
      expect(stageOffset(const Span(top: 200, height: 3000), 1000, viewport), 0);
      expect(stageOffset(const Span(top: -700, height: 3000), 1000, viewport), 700);
      expect(stageOffset(const Span(top: -5000, height: 3000), 1000, viewport), 2000);
    });
  });

  test('visible while any part overlaps the viewport', () {
    expect(isVisible(const Span(top: 900, height: 200), viewport), isTrue);
    expect(isVisible(const Span(top: 1000, height: 200), viewport), isFalse);
    expect(isVisible(const Span(top: -200, height: 200), viewport), isFalse);
  });

  group('tilt from gravity', () {
    test('is level held upright in portrait', () {
      final t = tiltOf(0, 9.81, 0);
      expect(t.x, closeTo(0, 1e-9));
      expect(t.y, closeTo(1, 1e-9));
    });

    test('reads the web player own ranges: flat, and rolled right', () {
      expect(tiltOf(0, 0, 9.81).y, closeTo(-1, 1e-9));
      expect(tiltOf(-9.81, 0, 0).x, closeTo(1, 1e-9));
      expect(tiltOf(9.81 * 0.5, 0, 9.81 * 0.866).x, closeTo(-30 / 45, 1e-3));
    });
  });
}
