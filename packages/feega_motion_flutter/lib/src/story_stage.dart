import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import 'progress.dart';

class StoryStage extends SingleChildRenderObjectWidget {
  const StoryStage({super.key, required this.stage, required this.length, required this.scroll, required super.child});

  final double stage;
  final int length;
  final Listenable scroll;

  @override
  RenderStoryStage createRenderObject(BuildContext context) => RenderStoryStage(stage, length, scroll);

  @override
  void updateRenderObject(BuildContext context, RenderStoryStage renderObject) {
    renderObject
      ..stage = stage
      ..length = length
      ..scroll = scroll;
  }
}

class RenderStoryStage extends RenderProxyBox {
  RenderStoryStage(this._stage, this._length, this._scroll);

  double _stage;
  int _length;
  Listenable _scroll;
  double _top = 0;

  set stage(double value) {
    if (value == _stage) {
      return;
    }
    _stage = value;
    markNeedsLayout();
  }

  set length(int value) {
    if (value == _length) {
      return;
    }
    _length = value;
    markNeedsLayout();
  }

  set scroll(Listenable value) {
    if (value == _scroll) {
      return;
    }
    if (attached) {
      _scroll.removeListener(markNeedsPaint);
      value.addListener(markNeedsPaint);
    }
    _scroll = value;
  }

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _scroll.addListener(markNeedsPaint);
  }

  @override
  void detach() {
    _scroll.removeListener(markNeedsPaint);
    super.detach();
  }

  @override
  void performLayout() {
    child?.layout(BoxConstraints.tightFor(width: constraints.maxWidth, height: _stage));
    size = constraints.constrain(Size(constraints.maxWidth, _stage * _length));
  }

  double _pinnedTop() {
    final viewport = RenderAbstractViewport.maybeOf(this);
    if (viewport is! RenderBox) {
      return 0;
    }
    final view = Span(top: 0, height: (viewport as RenderBox).size.height);
    final own = Span(top: localToGlobal(Offset.zero, ancestor: viewport).dy, height: size.height);
    return stageOffset(own, _stage, view);
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final stage = child;
    if (stage == null) {
      return;
    }
    _top = _pinnedTop();
    context.paintChild(stage, offset + Offset(0, _top));
  }

  @override
  void applyPaintTransform(RenderBox child, Matrix4 transform) => transform.multiply(Matrix4.translationValues(0, _top, 0));

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) {
    final stage = child;
    if (stage == null) {
      return false;
    }
    return result.addWithPaintOffset(offset: Offset(0, _top), position: position, hitTest: (result, local) => stage.hitTest(result, position: local));
  }
}
