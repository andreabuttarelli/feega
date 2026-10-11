import 'dart:math' as math;

class Span {
  const Span({required this.top, required this.height});

  final double top;
  final double height;
}

class Tilt {
  const Tilt(this.x, this.y);

  final double x;
  final double y;
}

const _tiltDegrees = 45.0;
const _uprightDegrees = 45.0;

double _unit(double v) => v.clamp(0.0, 1.0);

double _signed(double v) => v.clamp(-1.0, 1.0);

double _degrees(double radians) => radians * 180 / math.pi;

double travelProgress(Span box, Span viewport) => _unit((viewport.top + viewport.height - box.top) / (viewport.height + box.height));

double storyProgress(Span story, double stage, Span viewport) => _unit((viewport.top - story.top) / math.max(1, story.height - stage));

double stageOffset(Span story, double stage, Span viewport) => (viewport.top - story.top).clamp(0.0, math.max(0.0, story.height - stage));

bool isVisible(Span box, Span viewport) => box.top + box.height > viewport.top && box.top < viewport.top + viewport.height;

Tilt tiltOf(double ax, double ay, double az) {
  final beta = _degrees(math.atan2(ay, az));
  final gamma = _degrees(math.atan2(-ax, math.sqrt(ay * ay + az * az)));
  return Tilt(_signed(gamma / _tiltDegrees), _signed((beta - _uprightDegrees) / _tiltDegrees));
}
