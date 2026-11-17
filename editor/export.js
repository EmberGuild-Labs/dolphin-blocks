// Dolphin Blocks — project exporter.
// Bundles the generated program + the runtime library + a Flipper manifest into
// a .zip the user can unzip and build with `ufbt`. No external dependencies: a
// small STORE-method (uncompressed) zip writer lives here.

/* ---------- CRC32 ---------- */
const DB_CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function dbCrc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = DB_CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

const dbEnc = new TextEncoder();
function dbStr(s) {
    return dbEnc.encode(s);
}

/* ---------- Minimal STORE zip ---------- */
function dbZip(files) {
    // files: [{ name, data: Uint8Array }]
    const chunks = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
    const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

    for (const f of files) {
        const nameBytes = dbStr(f.name);
        const crc = dbCrc32(f.data);
        const size = f.data.length;

        // Local file header
        const local = [
            u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0),
            nameBytes, f.data,
        ];
        for (const c of local) chunks.push(c);

        // Central directory record
        central.push([
            u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
            u32(crc), u32(size), u32(size), u16(nameBytes.length),
            u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
        ]);

        offset += local.reduce((a, c) => a + c.length, 0);
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const rec of central) {
        for (const c of rec) {
            chunks.push(c);
            centralSize += c.length;
        }
    }

    chunks.push([
        u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
        u32(centralSize), u32(centralStart), u16(0),
    ].reduce((acc, c) => {
        const r = new Uint8Array(acc.length + c.length);
        r.set(acc);
        r.set(c, acc.length);
        return r;
    }, new Uint8Array(0)));

    // Flatten
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) {
        out.set(c, p);
        p += c.length;
    }
    return out;
}

/* ---------- Runtime files to bundle ---------- */
const DB_RUNTIME_FILES = [
    "dolphin_blocks.h",
    "dolphin_blocks_priv.h",
    "dolphin_blocks.c",
    "db_ir.c",
    "db_subghz.c",
    "db_nfc.c",
    "db_ble.c",
    "db_uart.c",
    "db_file.c",
    "db_list.c",
];

function dbSanitizeAppId(name) {
    let s = String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!s) s = "dolphin_app";
    if (/^[0-9]/.test(s)) s = "app_" + s;
    return s;
}

function dbBuildFam(appId, appName) {
    const safeName = appName.replace(/"/g, "'");
    return (
        "App(\n" +
        `    appid="${appId}",\n` +
        `    name="${safeName}",\n` +
        "    apptype=FlipperAppType.EXTERNAL,\n" +
        '    entry_point="dolphin_blocks_app",\n' +
        "    stack_size=4 * 1024,\n" +
        '    fap_category="Tools",\n' +
        '    fap_author="Dolphin Blocks",\n' +
        `    fap_description="${safeName} — built with Dolphin Blocks",\n` +
        '    sources=["*.c"],\n' +
        ")\n"
    );
}

function dbBuildReadme(appId, appName) {
    return (
        `# ${appName}\n\n` +
        "Built with **Dolphin Blocks**.\n\n" +
        "## Build & install\n\n" +
        "1. Install ufbt: `python3 -m pip install --upgrade ufbt`\n" +
        `2. Unzip this folder and \`cd ${appId}\`\n` +
        "3. Plug in your Flipper Zero over USB and run: `ufbt launch`\n\n" +
        "`ufbt launch` builds the app, copies it to the SD card and opens it. To only\n" +
        "build the .fap, run `ufbt` and find it under `dist/`.\n\n" +
        "All the Flipper code in this folder was generated from your blocks — you can\n" +
        "edit `generated_main.c` by hand if you want to, but re-exporting overwrites it.\n"
    );
}

async function dbFetchRuntime() {
    // Prefer the embedded runtime (works offline / from file://). Fall back to
    // fetching from ../runtime when the editor is served and not yet bundled.
    if (typeof window !== "undefined" && window.DOLPHIN_RUNTIME) {
        return DB_RUNTIME_FILES.map((name) => {
            const text = window.DOLPHIN_RUNTIME[name];
            if (text == null) throw new Error("Missing embedded runtime file: " + name);
            return { name, text };
        });
    }
    const files = [];
    for (const name of DB_RUNTIME_FILES) {
        const res = await fetch("../runtime/" + name, { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load runtime file: " + name);
        const text = await res.text();
        files.push({ name, text });
    }
    return files;
}

async function dolphinExport(appName, generatedC) {
    const appId = dbSanitizeAppId(appName);
    const runtime = await dbFetchRuntime();

    const entries = [];
    const base = appId + "/";
    for (const f of runtime) entries.push({ name: base + f.name, data: dbStr(f.text) });
    entries.push({ name: base + "generated_main.c", data: dbStr(generatedC) });
    entries.push({ name: base + "application.fam", data: dbStr(dbBuildFam(appId, appName)) });
    entries.push({ name: base + "README.md", data: dbStr(dbBuildReadme(appId, appName)) });

    const zip = dbZip(entries);

    // Inside the native macOS app, hand the bytes to the native save panel —
    // WKWebView does not reliably download blob: URLs on its own.
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.saveZip) {
        let bin = "";
        for (let i = 0; i < zip.length; i++) bin += String.fromCharCode(zip[i]);
        window.webkit.messageHandlers.saveZip.postMessage({ name: appId + ".zip", b64: btoa(bin) });
        return appId;
    }

    const blob = new Blob([zip], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = appId + ".zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return appId;
}
