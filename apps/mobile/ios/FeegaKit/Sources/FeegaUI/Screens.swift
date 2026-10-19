#if canImport(UIKit)
import SwiftUI
import FeegaCore

public struct RootView: View {
    @StateObject private var store: SessionStore

    public init(config: AppConfig) {
        _store = StateObject(wrappedValue: SessionStore(config: config))
    }

    public var body: some View {
        Group {
            if store.session == nil {
                LoginView()
            } else {
                HomeView()
            }
        }
        .environmentObject(store)
        .tint(.primary)
    }
}

struct LoginView: View {
    @EnvironmentObject private var store: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            Text("feega").font(.system(size: 56, weight: .semibold)).tracking(-2.5)
            Text("sign in to your canvases").foregroundStyle(.secondary)
            TextField("Email", text: $email)
                .textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(12).background(.quaternary, in: RoundedRectangle(cornerRadius: 4))
                .accessibilityIdentifier("login-email")
            SecureField("Password", text: $password)
                .textContentType(.password)
                .padding(12).background(.quaternary, in: RoundedRectangle(cornerRadius: 4))
                .accessibilityIdentifier("login-password")
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
            Button {
                Task { await submit() }
            } label: {
                Text(busy ? "Signing in…" : "Sign in").frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .disabled(busy || email.isEmpty || password.isEmpty)
            .accessibilityIdentifier("login-submit")
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
        .task {
            guard let demoEmail = DemoLaunch.current.email, let demoPassword = DemoLaunch.current.password else {
                return
            }
            email = demoEmail
            password = demoPassword
            await submit()
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await store.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch AuthError.rejected(let message) {
            error = message
        } catch {
            self.error = "No connection. Try again."
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var store: SessionStore
    @State private var selected: ProjectSummary?
    @State private var canvas: CanvasSummary?

    var body: some View {
        NavigationSplitView {
            ProjectsView(selected: $selected)
        } detail: {
            if let selected {
                CanvasesView(project: selected, open: { canvas = $0 }).id(selected.id)
            } else {
                Text("Choose a project").foregroundStyle(.secondary)
            }
        }
        .fullScreenCover(item: $canvas) { canvas in
            CanvasScreen(title: canvas.name, path: canvas.path)
        }
    }
}

struct ProjectsView: View {
    @EnvironmentObject private var store: SessionStore
    @Binding var selected: ProjectSummary?
    @State private var list: ProjectList?
    @State private var error: String?
    @State private var probe = PerfToggle.isOn

    var body: some View {
        List(selection: $selected) {
            if let error {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(list?.projects ?? []) { project in
                NavigationLink(value: project) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(project.name)
                        Text(project.lastActiveAt.prefix(10)).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(list?.org.name ?? "Projects")
        .toolbar {
            Menu {
                Toggle("Performance probe", isOn: $probe).onChange(of: probe) { PerfToggle.isOn = $0 }
                Button("Sign out", role: .destructive) { store.signOut() }
            } label: {
                Image(systemName: "person.crop.circle")
            }
        }
        .refreshable { await load() }
        .task {
            list = store.cache.load(ProjectList.self, key: "projects")
            await load()
        }
    }

    private func load() async {
        do {
            let fresh = try await store.api.projects(org: nil)
            store.cache.save(fresh, key: "projects")
            list = fresh
            error = nil
            if selected == nil, let index = DemoLaunch.current.projectIndex, fresh.projects.indices.contains(index) {
                selected = fresh.projects[index]
            }
        } catch {
            self.error = list == nil ? "Could not load projects." : "Offline: showing the last list."
        }
    }
}

extension ProjectSummary: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct CanvasesView: View {
    @EnvironmentObject private var store: SessionStore
    let project: ProjectSummary
    let open: (CanvasSummary) -> Void
    @State private var list: CanvasList?
    @State private var error: String?

    private var key: String { "canvases-\(project.id)" }

    var body: some View {
        List {
            if let error {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(list?.canvases ?? []) { canvas in
                Button {
                    open(canvas)
                } label: {
                    HStack {
                        Image(systemName: "square.on.square").foregroundStyle(.secondary)
                        Text(canvas.name).foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                    }
                }
                .accessibilityIdentifier("canvas-\(canvas.id)")
            }
        }
        .navigationTitle(project.name)
        .refreshable { await load() }
        .task {
            list = store.cache.load(CanvasList.self, key: key)
            await load()
        }
    }

    private func load() async {
        do {
            let fresh = try await store.api.canvases(projectId: project.id)
            store.cache.save(fresh, key: key)
            list = fresh
            error = nil
            if let index = DemoLaunch.current.canvasIndex, fresh.canvases.indices.contains(index) {
                open(fresh.canvases[index])
            }
        } catch {
            self.error = list == nil ? "Could not load canvases." : "Offline: showing the last list."
        }
    }
}
#endif
