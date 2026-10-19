#if canImport(UIKit)
import SwiftUI
import WebKit
import FeegaCore

enum WebSession {
    @MainActor
    static func inject(_ session: Session, config: AppConfig) async {
        let store = WKWebsiteDataStore.default().httpCookieStore
        for old in await store.allCookies() where old.name.hasPrefix(SessionCookie.name(projectRef: config.projectRef)) {
            await store.deleteCookie(old)
        }
        for (name, value) in SessionCookie.cookies(for: session, projectRef: config.projectRef) {
            var properties: [HTTPCookiePropertyKey: Any] = [
                .originURL: config.webBase,
                .path: "/",
                .name: name,
                .value: value,
                .expires: Date().addingTimeInterval(60 * 60 * 24 * 400)
            ]
            if config.webBase.scheme == "https" {
                properties[.secure] = "TRUE"
            }
            if let cookie = HTTPCookie(properties: properties) {
                await store.setCookie(cookie)
            }
        }
    }

    @MainActor
    static func readBack(config: AppConfig) async -> Session? {
        let cookies = await WKWebsiteDataStore.default().httpCookieStore.allCookies()
        let jar = Dictionary(cookies.filter { $0.domain == config.webBase.host }.map { ($0.name, $0.value) }) { a, _ in a }
        return SessionCookie.session(from: jar, projectRef: config.projectRef)
    }
}

struct WebSurface: UIViewControllerRepresentable {
    let origin: URL
    let path: String
    let probe: Bool
    let onSample: (PerfSample) -> Void

    func makeUIViewController(context: Context) -> WebSurfaceController {
        let controller = WebSurfaceController(origin: origin, path: path, probe: probe)
        controller.onSample = { sample in DispatchQueue.main.async { onSample(sample) } }
        return controller
    }

    func updateUIViewController(_ controller: WebSurfaceController, context: Context) {}
}

struct CanvasScreen: View {
    @EnvironmentObject private var store: SessionStore
    @Environment(\.dismiss) private var dismiss
    let title: String
    let path: String
    @State private var ready = false
    @State private var sample = PerfSample()
    @State private var probe = PerfToggle.isOn

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    Task { await close() }
                } label: {
                    Label(title, systemImage: "chevron.left").labelStyle(.titleAndIcon).lineLimit(1)
                }
                .accessibilityIdentifier("canvas-back")
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            ZStack(alignment: .topLeading) {
                if ready {
                    WebSurface(origin: store.config.webBase, path: path, probe: probe) { sample = $0 }
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                if probe {
                    PerfOverlay(sample: sample).padding(12).padding(.top, 60)
                }
            }
        }
        .task {
            if let session = store.session {
                await WebSession.inject(session, config: store.config)
            }
            ready = true
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func close() async {
        if let web = await WebSession.readBack(config: store.config), web.expiresAt > (store.session?.expiresAt ?? 0) {
            store.adopt(web)
        }
        dismiss()
    }
}

struct PerfOverlay: View {
    let sample: PerfSample
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(sample.report).font(.system(size: 11, design: .monospaced))
            Button(copied ? "Copied" : "Copy") {
                UIPasteboard.general.string = sample.report
                copied = true
            }
            .font(.caption.weight(.semibold))
        }
        .padding(10)
        .background(.black.opacity(0.75), in: RoundedRectangle(cornerRadius: 6))
        .foregroundStyle(.white)
        .allowsHitTesting(true)
    }
}
#endif
