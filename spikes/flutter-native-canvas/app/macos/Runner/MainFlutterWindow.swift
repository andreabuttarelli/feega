import Cocoa
import CoreVideo
import FlutterMacOS

final class CanvasTexture: NSObject, FlutterTexture {
  let buffer: CVPixelBuffer

  init?(width: Int, height: Int) {
    var made: CVPixelBuffer?
    let attrs: [CFString: Any] = [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary, kCVPixelBufferMetalCompatibilityKey: true]
    guard CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &made) == kCVReturnSuccess, let made else { return nil }
    buffer = made
  }

  var surface: Int {
    guard let s = CVPixelBufferGetIOSurface(buffer) else { return 0 }
    return Int(bitPattern: Unmanaged.passUnretained(s.takeUnretainedValue()).toOpaque())
  }

  func copyPixelBuffer() -> Unmanaged<CVPixelBuffer>? { Unmanaged.passRetained(buffer) }
}

final class CanvasChannel {
  private let registry: FlutterTextureRegistry
  private var textures: [Int64: CanvasTexture] = [:]

  init(controller: FlutterViewController) {
    registry = controller.engine
    let channel = FlutterMethodChannel(name: "feega/canvas", binaryMessenger: controller.engine.binaryMessenger)
    channel.setMethodCallHandler { [weak self] call, result in self?.handle(call, result) }
  }

  private func handle(_ call: FlutterMethodCall, _ result: FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "create":
      guard let tex = CanvasTexture(width: args["width"] as! Int, height: args["height"] as! Int) else { return result(nil) }
      let id = registry.register(tex)
      textures[id] = tex
      result(["id": id, "surface": tex.surface])
    case "frame":
      registry.textureFrameAvailable(args["id"] as! Int64)
      result(nil)
    case "dispose":
      let id = args["id"] as! Int64
      registry.unregisterTexture(id)
      textures[id] = nil
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}

class MainFlutterWindow: NSWindow {
  private var canvas: CanvasChannel?

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    self.contentViewController = flutterViewController
    self.setFrame(NSRect(x: 80, y: 80, width: 1600, height: 1000), display: true)
    self.title = "feega — Flutter native canvas"
    canvas = CanvasChannel(controller: flutterViewController)
    RegisterGeneratedPlugins(registry: flutterViewController)
    super.awakeFromNib()
  }
}
