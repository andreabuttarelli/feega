import 'package:feega_motion/feega_motion.dart';
import 'package:flutter/material.dart';

const saturn = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
const origin = String.fromEnvironment('FEEGA_ORIGIN', defaultValue: defaultOrigin);

void main() => runApp(const ExampleApp());

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'feega motion',
      theme: ThemeData.dark(useMaterial3: true),
      home: const SaturnPage(),
    );
  }
}

class SaturnPage extends StatefulWidget {
  const SaturnPage({super.key});

  @override
  State<SaturnPage> createState() => _SaturnPageState();
}

class _SaturnPageState extends State<SaturnPage> {
  final _motion = FeegaMotionController();
  String _status = 'loading';
  double _time = 0;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    return Scaffold(
      body: Stack(children: [
        ListView(children: [
          SizedBox(height: screen * 0.7, child: const Center(child: Text('Scroll to orbit Saturn', style: TextStyle(fontSize: 32)))),
          FeegaMotion(
            id: saturn,
            origin: origin,
            controller: _motion,
            tilt: true,
            onReady: (info) => setState(() => _status = 'ready ${info.playback.wire} ${info.duration}s'),
            onTimeUpdate: (time, _) => setState(() => _time = time),
            onEnded: () => setState(() => _status = 'ended'),
            onError: (message) => setState(() => _status = 'error $message'),
          ),
          SizedBox(height: screen * 0.5, child: const Center(child: Text('A card that fits its box, contained'))),
          SizedBox(height: 300, child: FeegaMotion(id: saturn, origin: origin, fit: Fit.contain, scrollLength: 0)),
          SizedBox(height: screen * 0.5),
        ]),
        Positioned(
          top: 12,
          left: 12,
          child: Container(
            color: Colors.black87,
            padding: const EdgeInsets.all(6),
            child: Text('$_status · ${_time.toStringAsFixed(2)}s', style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
          ),
        ),
      ]),
    );
  }
}
