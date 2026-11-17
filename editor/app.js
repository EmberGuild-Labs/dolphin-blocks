// Dolphin Blocks — app glue.
(function () {
    "use strict";

    const AUTOSAVE_KEY = "dolphin_blocks_autosave_v1";

    // Theme tuned for readable block text in light and dark.
    const theme = Blockly.Theme.defineTheme("dolphin", {
        base: Blockly.Themes.Classic,
        fontStyle: { family: "-apple-system, Segoe UI, Roboto, sans-serif", size: 11 },
        componentStyles: {
            workspaceBackgroundColour: getCssVar("--bg", "#f4f5f7"),
            toolboxBackgroundColour: getCssVar("--surface", "#ffffff"),
            flyoutBackgroundColour: getCssVar("--surface-2", "#f0f1f4"),
            scrollbarColour: "#b9bfca",
            insertionMarkerColour: "#ff6a00",
            insertionMarkerOpacity: 0.5,
        },
    });

    function getCssVar(name, fallback) {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) {
            return fallback;
        }
    }

    const workspace = Blockly.inject("blockly-area", {
        toolbox: DOLPHIN_TOOLBOX,
        theme: theme,
        renderer: "geras", // standard, predictable connection shapes
        media: "vendor/media/",
        sounds: false,
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
        grid: { spacing: 22, length: 3, colour: getCssVar("--border", "#d9dce2"), snap: true },
        // Typed connections are enforced by the block `check` fields; this keeps
        // mismatched shapes (e.g. a boolean in a number socket) from snapping.
    });

    const els = {
        appName: document.getElementById("app-name"),
        codePanel: document.getElementById("code-panel"),
        codeOut: document.getElementById("code-out"),
        btnNew: document.getElementById("btn-new"),
        btnSave: document.getElementById("btn-save"),
        btnLoad: document.getElementById("btn-load"),
        btnCode: document.getElementById("btn-code"),
        btnCodeClose: document.getElementById("btn-code-close"),
        btnExport: document.getElementById("btn-export"),
        fileInput: document.getElementById("file-input"),
        toast: document.getElementById("toast"),
    };

    let toastTimer = null;
    function toast(msg) {
        els.toast.textContent = msg;
        els.toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => (els.toast.hidden = true), 2600);
    }

    function currentAppName() {
        return (els.appName.value || "My Flipper App").trim() || "My Flipper App";
    }

    function generateCode() {
        dolphinC.appName = currentAppName();
        try {
            return dolphinC.workspaceToCode(workspace);
        } catch (e) {
            return "/* Code generation error: " + e.message + " */\n";
        }
    }

    function refreshCode() {
        if (!els.codePanel.hidden) {
            els.codeOut.textContent = generateCode();
        }
    }

    // Debounced autosave + code refresh.
    let saveTimer = null;
    function onWorkspaceChange(e) {
        if (e && e.isUiEvent) return;
        refreshCode();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(autosave, 500);
    }

    function autosave() {
        try {
            const state = Blockly.serialization.workspaces.save(workspace);
            localStorage.setItem(
                AUTOSAVE_KEY,
                JSON.stringify({ name: currentAppName(), blocks: state })
            );
        } catch (e) {
            /* storage may be unavailable (private mode) — ignore */
        }
    }

    function loadState(obj) {
        if (!obj) return;
        if (obj.name) els.appName.value = obj.name;
        if (obj.blocks) {
            Blockly.serialization.workspaces.load(obj.blocks, workspace);
        }
    }

    function seedDefault() {
        const state = {
            blocks: {
                languageVersion: 0,
                blocks: [
                    {
                        type: "db_on_start",
                        x: 60,
                        y: 60,
                        next: {
                            block: {
                                type: "db_print_text",
                                inputs: {
                                    TEXT: { shadow: { type: "text", fields: { TEXT: "Hello, Flipper!" } } },
                                },
                            },
                        },
                    },
                ],
            },
        };
        Blockly.serialization.workspaces.load(state, workspace);
    }

    /* ---------- Buttons ---------- */
    els.btnNew.addEventListener("click", () => {
        if (!confirm("Start a new empty project? This clears the current blocks.")) return;
        workspace.clear();
        seedDefault();
        toast("New project");
    });

    els.btnSave.addEventListener("click", () => {
        const state = Blockly.serialization.workspaces.save(workspace);
        const data = JSON.stringify({ name: currentAppName(), blocks: state }, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = currentAppName().replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".dolphin";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Project saved");
    });

    els.btnLoad.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const obj = JSON.parse(reader.result);
                workspace.clear();
                loadState(obj);
                toast("Project loaded");
            } catch (e) {
                toast("Could not read that file");
            }
        };
        reader.readAsText(file);
        els.fileInput.value = "";
    });

    function setCodeVisible(show) {
        els.codePanel.hidden = !show;
        els.btnCode.setAttribute("aria-pressed", String(show));
        if (show) {
            refreshCode();
            Blockly.svgResize(workspace);
        } else {
            Blockly.svgResize(workspace);
        }
    }
    els.btnCode.addEventListener("click", () => setCodeVisible(els.codePanel.hidden));
    els.btnCodeClose.addEventListener("click", () => setCodeVisible(false));

    els.btnExport.addEventListener("click", async () => {
        const code = generateCode();
        els.btnExport.disabled = true;
        els.btnExport.textContent = "Bundling…";
        try {
            const appId = await dolphinExport(currentAppName(), code);
            toast("Exported " + appId + ".zip — unzip and run: ufbt launch");
        } catch (e) {
            toast("Export failed: " + e.message);
        } finally {
            els.btnExport.disabled = false;
            els.btnExport.textContent = "Export app ↓";
        }
    });

    els.appName.addEventListener("input", () => {
        refreshCode();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(autosave, 500);
    });

    window.addEventListener("resize", () => Blockly.svgResize(workspace));

    /* ---------- Boot ---------- */
    let restored = false;
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (raw) {
            loadState(JSON.parse(raw));
            restored = true;
        }
    } catch (e) {
        // Autosave referenced an unknown/old block or was corrupt — start fresh
        // rather than leave a half-loaded workspace.
        try {
            workspace.clear();
        } catch (e2) {
            /* ignore */
        }
        restored = false;
    }
    if (!restored || workspace.getAllBlocks(false).length === 0) {
        seedDefault();
    }

    workspace.addChangeListener(onWorkspaceChange);

    // Keep the block palette pinned open and scrollable: the flyout stays visible
    // next to the category buttons instead of closing when you click the canvas
    // or drag a block out.
    try {
        const toolbox = workspace.getToolbox();
        if (toolbox) {
            const flyout = toolbox.getFlyout();
            if (flyout) flyout.autoClose = false;
            toolbox.selectItemByPosition(0); // open the first category on load
        }
    } catch (e) {
        /* non-fatal */
    }

    Blockly.svgResize(workspace);
    refreshCode();
})();
