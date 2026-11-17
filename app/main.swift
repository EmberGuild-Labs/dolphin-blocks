// Dolphin Blocks — minimal macOS wrapper around the web editor.
// Loads the bundled editor in a WKWebView and provides a native "save zip"
// bridge so the Export button writes a real .zip with a Save panel.
import Cocoa
import WebKit
import UniformTypeIdentifiers

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!

    func applicationDidFinishLaunching(_ note: Notification) {
        let frame = NSRect(x: 0, y: 0, width: 1280, height: 820)
        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false)
        window.title = "Dolphin Blocks"
        window.minSize = NSSize(width: 820, height: 560)
        window.center()

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "saveZip")
        config.userContentController.add(self, name: "saveFile")
        web = WKWebView(frame: frame, configuration: config)
        web.autoresizingMask = [.width, .height]
        window.contentView = web

        if let res = Bundle.main.resourceURL {
            let index = res.appendingPathComponent("editor/index.html")
            web.loadFileURL(index, allowingReadAccessTo: res)
        }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    // Receives { name, b64 } from Export (saveZip) or { name, text } from Save
    // (saveFile), and writes the file wherever the user chooses.
    func userContentController(
        _ controller: WKUserContentController, didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let name = body["name"] as? String
        else { return }

        var data: Data?
        if message.name == "saveZip", let b64 = body["b64"] as? String {
            data = Data(base64Encoded: b64)
        } else if message.name == "saveFile", let text = body["text"] as? String {
            data = text.data(using: .utf8)
        }
        guard let data = data else { return }

        let panel = NSSavePanel()
        panel.nameFieldStringValue = name
        if #available(macOS 11.0, *), name.hasSuffix(".zip") {
            panel.allowedContentTypes = [UTType.zip]
        }
        panel.canCreateDirectories = true
        panel.begin { [weak self] result in
            guard result == .OK, let url = panel.url else { return }
            do {
                try data.write(to: url)
                NSWorkspace.shared.activateFileViewerSelecting([url])
            } catch {
                let alert = NSAlert()
                alert.messageText = "Could not save"
                alert.informativeText = error.localizedDescription
                alert.runModal()
            }
            _ = self
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
