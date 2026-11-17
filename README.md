# 🐬 Dolphin Blocks

**Visual block programming for the Flipper Zero.** Drag blocks together, hit
**Export**, and get a folder that builds into a real Flipper app (`.fap`) — no C
knowledge required. It's built for people who want to *make* Flipper apps
(IR remotes, NFC readers, Sub-GHz replayers, BLE beacons, GPIO gadgets, WiFi dev
board tools) without learning the firmware API.

![categories: Program, Logic, Loops, Math, Text, Numbers, Text vars, Screen, Notify, Input, Infrared, Sub-GHz, NFC, Bluetooth, GPIO, WiFi/Serial](editor/vendor/media/sprites.png)

---

## What's in the box

| Part | What it is |
| --- | --- |
| **`editor/`** | The block editor — a self-contained web app (Blockly + a custom C code generator). This is what you drag blocks in. |
| **`runtime/`** | The Flipper C runtime library every exported app is built on. It wraps all the hardware (`db_*` functions) so generated code stays tiny and reliable. |
| **`app/`** + **`tools/`** | Sources + scripts to package the editor as a macOS app and a `.dmg`. |
| **`dist/DolphinBlocks.dmg`** | The packaged macOS app. |
| **`examples/`** | Ready-made `.dolphin` projects — open them in the editor to see how things fit together. |

---

## Using the editor

### Option A — the macOS app

Open **`dist/DolphinBlocks.dmg`**, drag **Dolphin Blocks** to Applications, and
launch it. (It's ad-hoc signed, so the first time you may need to right-click →
**Open**, or allow it under *System Settings → Privacy & Security*.)

### Option B — in a browser

```bash
cd dolphin
python3 -m http.server 8777
```

Then open <http://127.0.0.1:8777/editor/index.html>.

### How it works

1. Drag blocks from the left categories onto the canvas, under **when app starts**.
2. Give your app a name (top bar).
3. Click **View C** any time to see the exact Flipper C it generates.
4. Click **Export app** to download `<yourapp>.zip`.

**Save / Open** store your project as a `.dolphin` file so you can come back to it.
Your work is also auto-saved in the browser between sessions.

---

## Turning an export into an app on your Flipper

The export is a complete, buildable project. You need
[`ufbt`](https://github.com/flipperdevices/flipperzero-ufbt) (the micro Flipper
build tool):

```bash
python3 -m pip install --upgrade ufbt
```

Then:

```bash
unzip myapp.zip
cd myapp
ufbt launch    # builds it and installs+opens it on a plugged-in Flipper
```

`ufbt launch` compiles the app, copies the `.fap` to your SD card and opens it.
To only build the `.fap` (and find it under `dist/`), run `ufbt` on its own.

> The runtime targets the **Momentum** firmware SDK (what `ufbt` installs by
> default here). It builds clean against API 87.1 / target 7.

---

## The blocks

| Category | What you can do |
| --- | --- |
| **Logic** | if / else, and/or/not, comparisons, true/false |
| **Loops** | repeat N times, repeat forever, while/until, wait until, wait N ms, break |
| **Math** | numbers, + − × ÷, modulo, **random number between X and Y** |
| **Text** | text literals |
| **Numbers / Text vars** | make and use number and text variables |
| **Screen** | print lines, print labelled numbers, clear, draw text/boxes/lines/dots |
| **Notify** | RGB LED, custom LED colour, vibrate, beep, play notes/tones, success/error, backlight |
| **Input** | is-button-pressed, wait for a button, wait for any button |
| **Infrared** | send by protocol (NEC, Samsung, Sony SIRC, RC5/6…), send a saved `.ir` button, receive a signal |
| **Sub-GHz** | transmit a saved `.sub` file, listen on a frequency for activity |
| **NFC** | read a card's UID into a variable, emulate a saved `.nfc` file |
| **Bluetooth** | broadcast a BLE beacon by **name**, by **name + custom MAC**, or raw advertising bytes; stop broadcasting |
| **GPIO** | set pins input/output, read/write pins, PWM on pin A4 |
| **WiFi / Serial** | open the UART to an ESP32 dev board (or anything serial), send/receive lines |
| **Functions** | define a named, reusable group of blocks and call it anywhere; functions share your variables and lists |
| **Lists** | number lists: add, get/set an item (1-based), **for each** item, length, clear |
| **Files** | **pick file** (opens the Flipper's native file browser and returns the chosen path), check a file exists, read a line (or count lines), append/overwrite text, delete a file |

### Choosing files (the file picker)

Any block that takes a file path — IR/Sub-GHz/NFC "send file", and the Files
blocks — has a path *socket*. You can either:

- **type the path** into the little text box in the socket (e.g. `/ext/subghz/gate.sub`), or
- drop a **pick file** block (Files category) into that socket.

`pick file` takes a starting folder and a type filter (`.ir`, `.sub`, `.nfc`,
`.txt`, or *any*). When the app runs on the Flipper, it opens the Flipper's own
file browser so you scroll to and select the file **on the device** — then it
hands the chosen path straight to the block it's plugged into. Example:

> Sub-GHz send file **[ pick file in `/ext/subghz` type `.sub` ]**

On the computer there's no live view of the Flipper's SD card, which is why the
picker runs on the Flipper itself at run time.

### Running an exported app on the Flipper

The app shows a scrolling text console (and a drawing layer for the draw blocks).
Your blocks run top-to-bottom on a background thread. **Hold Back** to quit at any
time — loops and waits check for this so the app always exits cleanly.

---

## Notes on specific hardware

- **Bluetooth is a *beacon*, not a keyboard.** The BLE HID keyboard profile is
  disabled for external apps on this firmware, so instead the Bluetooth blocks
  broadcast a BLE advertisement. On a phone's Bluetooth scanner your Flipper
  shows up with the name (and MAC) you chose.
  - **Faraday-bag testing:** use **BLE advertise name + MAC**, set a memorable
    name and MAC, and watch it appear in your phone's Bluetooth list — then drop
    the Flipper in the bag and watch it vanish.
- **Sub-GHz / IR / NFC files** refer to paths on the Flipper's SD card, e.g.
  `/ext/subghz/gate.sub`, `/ext/infrared/TV.ir`, `/ext/nfc/card.nfc`.
- **Sub-GHz TX** uses the internal CC1101 and supports both RAW and protocol
  `.sub` files.
- Respect your local laws and only transmit on bands / to devices you're
  allowed to.

---

## Why the pitfalls from "blocks → Arduino" don't happen here

- **No oval-in-oval weirdness.** Blocks use Blockly's standard `geras` renderer
  with *typed* connections — a boolean only drops into a boolean socket, a number
  into a number socket — so reporter blocks sit inline and read left-to-right.
- **No accidental text selection while dragging.** Text selection is disabled
  everywhere except the actual input fields (`user-select: none` on the shell,
  re-enabled on inputs), so dragging never highlights page text.
- **Sockets arrive pre-filled.** Numeric inputs come with shadow values already
  in place, so you never stare at an empty hole wondering what goes there.

---

## Rebuilding the macOS app / DMG

```bash
bash tools/build_app.sh
```

This re-bundles the runtime into the editor, compiles the Swift wrapper
(`app/main.swift`, a WKWebView around the editor with a native Save panel for
Export), assembles `build/DolphinBlocks.app`, and writes `dist/DolphinBlocks.dmg`.
Requires the Xcode Command Line Tools.

If you change anything in `runtime/`, re-run the bundler so the editor ships the
latest runtime in its exports:

```bash
python3 tools/bundle_runtime.py
```

---

## Project layout

```
dolphin/
├── editor/                 # the block editor (web app)
│   ├── index.html
│   ├── style.css
│   ├── blocks.js           # block definitions
│   ├── generator.js        # Blockly → Flipper C generator
│   ├── toolbox.js          # category palette
│   ├── export.js           # bundles a buildable project (zip)
│   ├── app.js              # editor glue, save/load, live preview
│   ├── runtime_sources.js  # embedded runtime (auto-generated)
│   └── vendor/             # Blockly, bundled locally for offline use
├── runtime/                # Flipper C runtime (the db_* API)
│   ├── dolphin_blocks.h/.c # core: UI, threading, screen, input, notify, GPIO, random
│   ├── db_ir.c             # infrared
│   ├── db_subghz.c         # sub-GHz
│   ├── db_nfc.c            # NFC
│   ├── db_ble.c            # BLE beacon
│   ├── db_uart.c           # UART / WiFi dev board
│   ├── db_file.c           # SD-card files + native file picker
│   └── db_list.c           # number-list helpers
├── app/                    # macOS wrapper (Swift) + icon
├── tools/                  # bundle_runtime.py, build_app.sh
├── examples/               # sample .dolphin projects
└── dist/                   # DolphinBlocks.dmg
```

## License & credits

Dolphin Blocks is released under the [MIT License](LICENSE).

It bundles [Blockly](https://developers.google.com/blockly) (`editor/vendor/`),
which is © Google and licensed under Apache-2.0.

## Decisions made along the way

- **Blockly over a custom drag engine.** The previous blocks→Arduino project hit
  drag/snap bugs; Blockly's mature connection system plus typed sockets avoids
  them and gives us save/load, zoom, and the flyout for free.
- **A runtime library + a thin generator**, instead of generating big hairy C per
  block. Generated programs are a readable list of `db_*` calls; all the Flipper
  complexity (threads, workers, radio setup/teardown) lives in `runtime/` where
  it's written and tested once. Every feature here compiles and links into a
  runnable `.fap` (verified with `ufbt` + `APPCHK`).
- **Everything bundled locally** (Blockly + runtime embedded in the editor) so the
  packaged app works with no internet and Export works offline.
