// Dolphin Blocks — custom block definitions.
// Built-in Blockly blocks (controls_if, logic_*, math_*, text, controls_repeat_ext,
// controls_whileUntil, controls_flow_statements) are reused directly in the toolbox.

/* Category colours */
const C_PROGRAM = "#9b59b6";
const C_LOGIC = "#4C97FF";
const C_LOOP = "#59C059";
const C_MATH = "#5CB1D6";
const C_TEXT = "#8E7CC3";
const C_VAR_NUM = "#FF8C1A";
const C_VAR_TXT = "#D65CA8";
const C_SCREEN = "#546E7A";
const C_NOTIFY = "#F2C037";
const C_INPUT = "#7E57C2";
const C_IR = "#E5004C";
const C_SUBGHZ = "#FF6A00";
const C_NFC = "#0098FF";
const C_BLE = "#2E7DFF";
const C_GPIO = "#8B5CF6";
const C_UART = "#10B981";
const C_FILE = "#B07D3C";

/* Shared dropdown option lists */
const PIN_OPTIONS = [
    ["A7 (pin 2)", "DbPin_PA7"],
    ["A6 (pin 3)", "DbPin_PA6"],
    ["A4 (pin 4)", "DbPin_PA4"],
    ["B3 (pin 5)", "DbPin_PB3"],
    ["B2 (pin 6)", "DbPin_PB2"],
    ["C3 (pin 7)", "DbPin_PC3"],
    ["C1 (pin 15)", "DbPin_PC1"],
    ["C0 (pin 16)", "DbPin_PC0"],
];
const BTN_OPTIONS = [
    ["Up", "DbBtnUp"],
    ["Down", "DbBtnDown"],
    ["Left", "DbBtnLeft"],
    ["Right", "DbBtnRight"],
    ["OK", "DbBtnOk"],
];
const IR_PROTOCOLS = [
    ["NEC", "NEC"], ["NECext", "NECext"], ["Samsung32", "Samsung32"],
    ["RC5", "RC5"], ["RC6", "RC6"], ["Sony SIRC", "SIRC"],
    ["SIRC15", "SIRC15"], ["SIRC20", "SIRC20"], ["Kaseikyo", "Kaseikyo"], ["RCA", "RCA"],
];
const KEY_OPTIONS = [
    ["Enter", "ENTER"], ["Tab", "TAB"], ["Esc", "ESC"], ["Space", "SPACE"],
    ["Backspace", "BACKSPACE"], ["Delete", "DELETE"],
    ["Up", "UP"], ["Down", "DOWN"], ["Left", "LEFT"], ["Right", "RIGHT"],
    ["Win/Cmd (GUI)", "GUI"], ["Ctrl", "CTRL"], ["Alt", "ALT"],
];
const BAUD_OPTIONS = [
    ["115200", "115200"], ["9600", "9600"], ["19200", "19200"],
    ["38400", "38400"], ["57600", "57600"], ["230400", "230400"],
];
const COLOR_OPTIONS = [
    ["Red", "255,0,0"], ["Green", "0,255,0"], ["Blue", "0,0,255"],
    ["Yellow", "255,180,0"], ["Cyan", "0,255,255"], ["Magenta", "255,0,255"],
    ["White", "255,255,255"],
];
// Musical notes → frequency (Hz).
const NOTE_OPTIONS = [
    ["C4", "261.63"], ["D4", "293.66"], ["E4", "329.63"], ["F4", "349.23"],
    ["G4", "392.00"], ["A4", "440.00"], ["B4", "493.88"],
    ["C5", "523.25"], ["D5", "587.33"], ["E5", "659.25"], ["G5", "783.99"],
];

Blockly.defineBlocksWithJsonArray([
    /* ---------------- Program ---------------- */
    {
        type: "db_on_start",
        message0: "when app starts",
        nextStatement: null,
        colour: C_PROGRAM,
        tooltip: "Everything under here runs top to bottom when your app opens.",
        helpUrl: "",
    },

    /* ---------------- Loops ---------------- */
    {
        type: "db_forever",
        message0: "repeat forever %1 %2",
        args0: [
            { type: "input_dummy" },
            { type: "input_statement", name: "DO" },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: C_LOOP,
        tooltip: "Loop forever (until Back is held).",
    },
    {
        type: "db_delay",
        message0: "wait %1 ms",
        args0: [{ type: "input_value", name: "MS", check: "Number" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_LOOP,
        tooltip: "Pause the program for a number of milliseconds (1000 ms = 1 second).",
    },
    {
        type: "db_wait_until",
        message0: "wait until %1",
        args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_LOOP,
        tooltip: "Pause here until the condition becomes true.",
    },

    /* ---------------- Number variables ---------------- */
    {
        type: "db_num_set",
        message0: "set number %1 to %2",
        args0: [
            { type: "field_input", name: "VAR", text: "score" },
            { type: "input_value", name: "VALUE", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_VAR_NUM,
        tooltip: "Create or update a number variable.",
    },
    {
        type: "db_num_change",
        message0: "change number %1 by %2",
        args0: [
            { type: "field_input", name: "VAR", text: "score" },
            { type: "input_value", name: "VALUE", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_VAR_NUM,
        tooltip: "Add to a number variable (use a negative value to subtract).",
    },
    {
        type: "db_num_get",
        message0: "number %1",
        args0: [{ type: "field_input", name: "VAR", text: "score" }],
        output: "Number",
        colour: C_VAR_NUM,
        tooltip: "The current value of a number variable.",
    },

    /* ---------------- Text variables ---------------- */
    {
        type: "db_txt_set",
        message0: "set text %1 to %2",
        args0: [
            { type: "field_input", name: "VAR", text: "message" },
            { type: "input_value", name: "VALUE", check: "String" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_VAR_TXT,
        tooltip: "Create or update a text variable.",
    },
    {
        type: "db_txt_get",
        message0: "text %1",
        args0: [{ type: "field_input", name: "VAR", text: "message" }],
        output: "String",
        colour: C_VAR_TXT,
        tooltip: "The current value of a text variable.",
    },

    /* ---------------- Screen ---------------- */
    {
        type: "db_print_text",
        message0: "print %1",
        args0: [{ type: "input_value", name: "TEXT" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Print a line of text or a number to the screen.",
    },
    {
        type: "db_print_label_num",
        message0: "print label %1 number %2",
        args0: [
            { type: "field_input", name: "LABEL", text: "Score: " },
            { type: "input_value", name: "VALUE", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: 'Print a label plus a whole number, e.g. "Score: 5".',
    },
    {
        type: "db_clear",
        message0: "clear screen",
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Clear the screen.",
    },
    {
        type: "db_draw_text",
        message0: "draw text %1 at x %2 y %3",
        args0: [
            { type: "input_value", name: "TXT", check: "String" },
            { type: "input_value", name: "X", check: "Number" },
            { type: "input_value", name: "Y", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Draw text at a pixel position (x 0-127, y 0-63).",
    },
    {
        type: "db_draw_box",
        message0: "draw %1 box at x %2 y %3 w %4 h %5",
        args0: [
            { type: "field_dropdown", name: "FILLED", options: [["filled", "true"], ["outline", "false"]] },
            { type: "input_value", name: "X", check: "Number" },
            { type: "input_value", name: "Y", check: "Number" },
            { type: "input_value", name: "W", check: "Number" },
            { type: "input_value", name: "H", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Draw a rectangle.",
    },
    {
        type: "db_draw_line",
        message0: "draw line x1 %1 y1 %2 to x2 %3 y2 %4",
        args0: [
            { type: "input_value", name: "X0", check: "Number" },
            { type: "input_value", name: "Y0", check: "Number" },
            { type: "input_value", name: "X1", check: "Number" },
            { type: "input_value", name: "Y1", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Draw a line between two points.",
    },
    {
        type: "db_canvas_clear",
        message0: "clear drawing",
        previousStatement: null,
        nextStatement: null,
        colour: C_SCREEN,
        tooltip: "Erase everything drawn on the screen.",
    },

    /* ---------------- Notify ---------------- */
    {
        type: "db_led_named",
        message0: "LED %1",
        args0: [{ type: "field_dropdown", name: "COLOR", options: COLOR_OPTIONS }],
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Light the LED a colour.",
    },
    {
        type: "db_led_rgb",
        message0: "LED red %1 green %2 blue %3",
        args0: [
            { type: "input_value", name: "R", check: "Number" },
            { type: "input_value", name: "G", check: "Number" },
            { type: "input_value", name: "B", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Light the LED a custom colour (each channel 0-255).",
    },
    {
        type: "db_led_off",
        message0: "LED off",
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Turn the LED off.",
    },
    {
        type: "db_buzz",
        message0: "vibrate for %1 ms",
        args0: [{ type: "input_value", name: "MS", check: "Number" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Buzz the vibration motor.",
    },
    {
        type: "db_beep",
        message0: "beep",
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Short beep.",
    },
    {
        type: "db_note",
        message0: "play note %1 for %2 ms",
        args0: [
            { type: "field_dropdown", name: "NOTE", options: NOTE_OPTIONS },
            { type: "input_value", name: "MS", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Play a musical note.",
    },
    {
        type: "db_tone",
        message0: "play tone %1 Hz for %2 ms",
        args0: [
            { type: "input_value", name: "FREQ", check: "Number" },
            { type: "input_value", name: "MS", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Play a tone at a frequency.",
    },
    {
        type: "db_feedback",
        message0: "play %1 feedback",
        args0: [{ type: "field_dropdown", name: "KIND", options: [["success", "success"], ["error", "error"]] }],
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Play the built-in success or error light+sound.",
    },
    {
        type: "db_backlight",
        message0: "backlight %1",
        args0: [{ type: "field_dropdown", name: "STATE", options: [["on", "true"], ["off", "false"]] }],
        previousStatement: null,
        nextStatement: null,
        colour: C_NOTIFY,
        tooltip: "Turn the screen backlight on or off.",
    },

    /* ---------------- Input ---------------- */
    {
        type: "db_is_pressed",
        message0: "%1 button pressed?",
        args0: [{ type: "field_dropdown", name: "BTN", options: BTN_OPTIONS }],
        output: "Boolean",
        colour: C_INPUT,
        tooltip: "True right now if that button is held down.",
    },
    {
        type: "db_wait_button",
        message0: "wait for %1 button",
        args0: [{ type: "field_dropdown", name: "BTN", options: BTN_OPTIONS }],
        previousStatement: null,
        nextStatement: null,
        colour: C_INPUT,
        tooltip: "Pause until that button is pressed.",
    },
    {
        type: "db_wait_any",
        message0: "wait for any button",
        previousStatement: null,
        nextStatement: null,
        colour: C_INPUT,
        tooltip: "Pause until any button is pressed.",
    },

    /* ---------------- Infrared ---------------- */
    {
        type: "db_ir_send",
        message0: "IR send %1 address %2 command %3",
        args0: [
            { type: "field_dropdown", name: "PROTO", options: IR_PROTOCOLS },
            { type: "input_value", name: "ADDR", check: "Number" },
            { type: "input_value", name: "CMD", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_IR,
        tooltip: "Send an infrared command (address/command are numbers, e.g. from a remote database).",
    },
    {
        type: "db_ir_send_file",
        message0: "IR send file %1 button %2",
        args0: [
            { type: "input_value", name: "PATH", check: "String" },
            { type: "field_input", name: "BUTTON", text: "Power" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_IR,
        tooltip: "Send a saved button from a .ir file on the SD card. Type a path or plug in a 'pick file' block.",
    },
    {
        type: "db_ir_receive",
        message0: "IR received within %1 ms → store in %2",
        args0: [
            { type: "input_value", name: "MS", check: "Number" },
            { type: "field_input", name: "VAR", text: "signal" },
        ],
        inputsInline: true,
        output: "Boolean",
        colour: C_IR,
        tooltip: "Listen for an IR signal. True if one arrived; its description is saved to the text variable.",
    },

    /* ---------------- Sub-GHz ---------------- */
    {
        type: "db_subghz_send_file",
        message0: "Sub-GHz send file %1",
        args0: [{ type: "input_value", name: "PATH", check: "String" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_SUBGHZ,
        tooltip: "Transmit a saved .sub file from the SD card. Type a path or plug in a 'pick file' block.",
    },
    {
        type: "db_subghz_listen",
        message0: "Sub-GHz signal on %1 Hz within %2 ms?",
        args0: [
            { type: "input_value", name: "FREQ", check: "Number" },
            { type: "input_value", name: "MS", check: "Number" },
        ],
        inputsInline: true,
        output: "Boolean",
        colour: C_SUBGHZ,
        tooltip: "Listen on a frequency (e.g. 433920000). True if a signal was detected.",
    },

    /* ---------------- NFC ---------------- */
    {
        type: "db_nfc_read",
        message0: "NFC card read within %1 ms → UID in %2",
        args0: [
            { type: "input_value", name: "MS", check: "Number" },
            { type: "field_input", name: "VAR", text: "uid" },
        ],
        inputsInline: true,
        output: "Boolean",
        colour: C_NFC,
        tooltip: "Scan for an NFC card. True if found; its UID (hex) is saved to the text variable.",
    },
    {
        type: "db_nfc_emulate",
        message0: "NFC emulate file %1 for %2 ms",
        args0: [
            { type: "input_value", name: "PATH", check: "String" },
            { type: "input_value", name: "MS", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_NFC,
        tooltip: "Emulate a saved .nfc card.",
    },

    /* ---------------- Bluetooth LE broadcast ---------------- */
    {
        type: "db_ble_broadcast_name",
        message0: "BLE broadcast name %1",
        args0: [{ type: "input_value", name: "NAME", check: "String" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_BLE,
        tooltip: "Broadcast a Bluetooth advertisement; the Flipper shows up with this name on a phone's Bluetooth scanner.",
    },
    {
        type: "db_ble_broadcast_name_mac",
        message0: "BLE advertise name %1 MAC %2",
        args0: [
            { type: "input_value", name: "NAME", check: "String" },
            { type: "field_input", name: "MAC", text: "AA:BB:CC:DD:EE:FF" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_BLE,
        tooltip: "Broadcast with a fixed name AND MAC address — great for Faraday-bag tests (watch it disappear from your phone's Bluetooth list).",
    },
    {
        type: "db_ble_broadcast_raw",
        message0: "BLE broadcast raw hex %1",
        args0: [{ type: "field_input", name: "HEX", text: "02 01 06" }],
        previousStatement: null,
        nextStatement: null,
        colour: C_BLE,
        tooltip: "Advanced: broadcast raw advertising bytes (hex, up to 31 bytes).",
    },
    {
        type: "db_ble_broadcast_stop",
        message0: "BLE stop broadcasting",
        previousStatement: null,
        nextStatement: null,
        colour: C_BLE,
        tooltip: "Stop the Bluetooth broadcast.",
    },

    /* ---------------- GPIO ---------------- */
    {
        type: "db_gpio_out",
        message0: "set pin %1 as output",
        args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }],
        previousStatement: null,
        nextStatement: null,
        colour: C_GPIO,
        tooltip: "Configure a GPIO pin as an output.",
    },
    {
        type: "db_gpio_in",
        message0: "set pin %1 as input %2",
        args0: [
            { type: "field_dropdown", name: "PIN", options: PIN_OPTIONS },
            { type: "field_dropdown", name: "PULL", options: [["pull-up", "true"], ["no pull", "false"]] },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: C_GPIO,
        tooltip: "Configure a GPIO pin as an input.",
    },
    {
        type: "db_gpio_write",
        message0: "set pin %1 %2",
        args0: [
            { type: "field_dropdown", name: "PIN", options: PIN_OPTIONS },
            { type: "field_dropdown", name: "LEVEL", options: [["HIGH", "true"], ["LOW", "false"]] },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: C_GPIO,
        tooltip: "Drive an output pin high (3.3V) or low (0V).",
    },
    {
        type: "db_gpio_read",
        message0: "pin %1 is HIGH?",
        args0: [{ type: "field_dropdown", name: "PIN", options: PIN_OPTIONS }],
        output: "Boolean",
        colour: C_GPIO,
        tooltip: "True if the input pin reads HIGH.",
    },
    {
        type: "db_pwm_start",
        message0: "PWM on A4: %1 Hz at %2 %% duty",
        args0: [
            { type: "input_value", name: "FREQ", check: "Number" },
            { type: "input_value", name: "DUTY", check: "Number" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_GPIO,
        tooltip: "Start a PWM square wave on pin A4.",
    },
    {
        type: "db_pwm_stop",
        message0: "PWM stop",
        previousStatement: null,
        nextStatement: null,
        colour: C_GPIO,
        tooltip: "Stop PWM output.",
    },

    /* ---------------- UART / WiFi dev board ---------------- */
    {
        type: "db_uart_begin",
        message0: "serial begin at %1 baud",
        args0: [{ type: "field_dropdown", name: "BAUD", options: BAUD_OPTIONS }],
        previousStatement: null,
        nextStatement: null,
        colour: C_UART,
        tooltip: "Open the UART (pins 13 TX / 14 RX) to talk to a WiFi dev board or any serial device.",
    },
    {
        type: "db_uart_writeln",
        message0: "serial send line %1",
        args0: [{ type: "input_value", name: "TEXT", check: "String" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_UART,
        tooltip: "Send text followed by a newline.",
    },
    {
        type: "db_uart_write",
        message0: "serial send %1",
        args0: [{ type: "input_value", name: "TEXT", check: "String" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_UART,
        tooltip: "Send text with no newline added.",
    },
    {
        type: "db_uart_read",
        message0: "serial line received within %1 ms → store in %2",
        args0: [
            { type: "input_value", name: "MS", check: "Number" },
            { type: "field_input", name: "VAR", text: "line" },
        ],
        inputsInline: true,
        output: "Boolean",
        colour: C_UART,
        tooltip: "Wait for a line of serial text. True if one arrived; it is saved to the text variable.",
    },
    {
        type: "db_uart_end",
        message0: "serial end",
        previousStatement: null,
        nextStatement: null,
        colour: C_UART,
        tooltip: "Close the UART.",
    },

    /* ---------------- Files ---------------- */
    {
        type: "db_pick_file",
        message0: "pick file in %1 type %2",
        args0: [
            { type: "field_input", name: "DIR", text: "/ext" },
            {
                type: "field_dropdown",
                name: "EXT",
                options: [
                    ["any", "*"],
                    [".ir", ".ir"],
                    [".sub", ".sub"],
                    [".nfc", ".nfc"],
                    [".rfid", ".rfid"],
                    [".txt", ".txt"],
                    [".ibtn", ".ibtn"],
                ],
            },
        ],
        inputsInline: true,
        output: "String",
        colour: C_FILE,
        tooltip: "Open the Flipper's file browser and return the file you choose. Plug this into any file path.",
    },
    {
        type: "db_file_exists",
        message0: "file %1 exists?",
        args0: [{ type: "input_value", name: "PATH", check: "String" }],
        inputsInline: true,
        output: "Boolean",
        colour: C_FILE,
        tooltip: "True if the file exists on the SD card.",
    },
    {
        type: "db_file_read_line",
        message0: "read line %1 of file %2 → store in %3",
        args0: [
            { type: "input_value", name: "LINE", check: "Number" },
            { type: "input_value", name: "PATH", check: "String" },
            { type: "field_input", name: "VAR", text: "line" },
        ],
        inputsInline: true,
        output: "Boolean",
        colour: C_FILE,
        tooltip: "Read one line (1 = first line) into a text variable. True if that line exists.",
    },
    {
        type: "db_file_line_count",
        message0: "number of lines in file %1",
        args0: [{ type: "input_value", name: "PATH", check: "String" }],
        inputsInline: true,
        output: "Number",
        colour: C_FILE,
        tooltip: "How many lines the file has.",
    },
    {
        type: "db_file_append_line",
        message0: "append line %1 to file %2",
        args0: [
            { type: "input_value", name: "TEXT", check: "String" },
            { type: "input_value", name: "PATH", check: "String" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_FILE,
        tooltip: "Add a line to the end of a file (creates it if missing).",
    },
    {
        type: "db_file_write",
        message0: "write %1 to file %2 (replace)",
        args0: [
            { type: "input_value", name: "TEXT", check: "String" },
            { type: "input_value", name: "PATH", check: "String" },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_FILE,
        tooltip: "Overwrite a file with this text (erases any existing contents).",
    },
    {
        type: "db_file_delete",
        message0: "delete file %1",
        args0: [{ type: "input_value", name: "PATH", check: "String" }],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: C_FILE,
        tooltip: "Delete a file from the SD card.",
    },
]);
