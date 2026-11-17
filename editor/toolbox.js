// Dolphin Blocks — toolbox definition.
// Shadow blocks pre-fill numeric/text sockets so new blocks never show an empty
// socket the user has to guess at.

function num(n) {
    return { shadow: { type: "math_number", fields: { NUM: n } } };
}
function txt(s) {
    return { shadow: { type: "text", fields: { TEXT: s } } };
}

const DOLPHIN_TOOLBOX = {
    kind: "categoryToolbox",
    contents: [
        {
            kind: "category",
            name: "Program",
            colour: "#9b59b6",
            contents: [{ kind: "block", type: "db_on_start" }],
        },
        {
            kind: "category",
            name: "Logic",
            colour: "#4C97FF",
            contents: [
                { kind: "block", type: "controls_if" },
                {
                    kind: "block",
                    type: "logic_compare",
                    inputs: { A: num(0), B: num(0) },
                },
                { kind: "block", type: "logic_operation" },
                { kind: "block", type: "logic_negate" },
                { kind: "block", type: "logic_boolean" },
            ],
        },
        {
            kind: "category",
            name: "Loops",
            colour: "#59C059",
            contents: [
                { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: num(10) } },
                { kind: "block", type: "db_forever" },
                { kind: "block", type: "controls_whileUntil" },
                { kind: "block", type: "db_wait_until" },
                { kind: "block", type: "db_delay", inputs: { MS: num(1000) } },
                { kind: "block", type: "controls_flow_statements" },
            ],
        },
        {
            kind: "category",
            name: "Math",
            colour: "#5CB1D6",
            contents: [
                { kind: "block", type: "math_number", fields: { NUM: 0 } },
                { kind: "block", type: "math_arithmetic", inputs: { A: num(1), B: num(1) } },
                { kind: "block", type: "math_modulo", inputs: { DIVIDEND: num(10), DIVISOR: num(3) } },
                { kind: "block", type: "math_random_int", inputs: { FROM: num(1), TO: num(100) } },
            ],
        },
        {
            kind: "category",
            name: "Text",
            colour: "#8E7CC3",
            contents: [{ kind: "block", type: "text", fields: { TEXT: "hello" } }],
        },
        {
            kind: "category",
            name: "Numbers",
            colour: "#FF8C1A",
            contents: [
                { kind: "block", type: "db_num_set", inputs: { VALUE: num(0) } },
                { kind: "block", type: "db_num_change", inputs: { VALUE: num(1) } },
                { kind: "block", type: "db_num_get" },
            ],
        },
        {
            kind: "category",
            name: "Text vars",
            colour: "#D65CA8",
            contents: [
                { kind: "block", type: "db_txt_set", inputs: { VALUE: txt("hello") } },
                { kind: "block", type: "db_txt_get" },
            ],
        },
        {
            kind: "category",
            name: "Screen",
            colour: "#546E7A",
            contents: [
                { kind: "block", type: "db_print_text", inputs: { TEXT: txt("Hello!") } },
                { kind: "block", type: "db_print_label_num", inputs: { VALUE: num(0) } },
                { kind: "block", type: "db_clear" },
                { kind: "block", type: "db_draw_text", inputs: { TXT: txt("Hi"), X: num(10), Y: num(20) } },
                { kind: "block", type: "db_draw_box", inputs: { X: num(10), Y: num(10), W: num(40), H: num(20) } },
                { kind: "block", type: "db_draw_line", inputs: { X0: num(0), Y0: num(0), X1: num(60), Y1: num(40) } },
                { kind: "block", type: "db_canvas_clear" },
            ],
        },
        {
            kind: "category",
            name: "Notify",
            colour: "#F2C037",
            contents: [
                { kind: "block", type: "db_led_named" },
                { kind: "block", type: "db_led_rgb", inputs: { R: num(255), G: num(0), B: num(0) } },
                { kind: "block", type: "db_led_off" },
                { kind: "block", type: "db_buzz", inputs: { MS: num(200) } },
                { kind: "block", type: "db_beep" },
                { kind: "block", type: "db_note", inputs: { MS: num(300) } },
                { kind: "block", type: "db_tone", inputs: { FREQ: num(440), MS: num(300) } },
                { kind: "block", type: "db_feedback" },
                { kind: "block", type: "db_backlight" },
            ],
        },
        {
            kind: "category",
            name: "Input",
            colour: "#7E57C2",
            contents: [
                { kind: "block", type: "db_is_pressed" },
                { kind: "block", type: "db_wait_button" },
                { kind: "block", type: "db_wait_any" },
            ],
        },
        {
            kind: "category",
            name: "Infrared",
            colour: "#E5004C",
            contents: [
                { kind: "block", type: "db_ir_send", inputs: { ADDR: num(0), CMD: num(0) } },
                { kind: "block", type: "db_ir_send_file", inputs: { PATH: txt("/ext/infrared/TV.ir") } },
                { kind: "block", type: "db_ir_receive", inputs: { MS: num(3000) } },
            ],
        },
        {
            kind: "category",
            name: "Sub-GHz",
            colour: "#FF6A00",
            contents: [
                { kind: "block", type: "db_subghz_send_file", inputs: { PATH: txt("/ext/subghz/gate.sub") } },
                { kind: "block", type: "db_subghz_listen", inputs: { FREQ: num(433920000), MS: num(3000) } },
            ],
        },
        {
            kind: "category",
            name: "NFC",
            colour: "#0098FF",
            contents: [
                { kind: "block", type: "db_nfc_read", inputs: { MS: num(3000) } },
                { kind: "block", type: "db_nfc_emulate", inputs: { PATH: txt("/ext/nfc/card.nfc"), MS: num(10000) } },
            ],
        },
        {
            kind: "category",
            name: "Bluetooth",
            colour: "#2E7DFF",
            contents: [
                { kind: "block", type: "db_ble_broadcast_name", inputs: { NAME: txt("Flipper Zero") } },
                { kind: "block", type: "db_ble_broadcast_name_mac", inputs: { NAME: txt("FaradayTest") } },
                { kind: "block", type: "db_ble_broadcast_raw" },
                { kind: "block", type: "db_ble_broadcast_stop" },
            ],
        },
        {
            kind: "category",
            name: "GPIO",
            colour: "#8B5CF6",
            contents: [
                { kind: "block", type: "db_gpio_out" },
                { kind: "block", type: "db_gpio_in" },
                { kind: "block", type: "db_gpio_write" },
                { kind: "block", type: "db_gpio_read" },
                { kind: "block", type: "db_pwm_start", inputs: { FREQ: num(1000), DUTY: num(50) } },
                { kind: "block", type: "db_pwm_stop" },
            ],
        },
        {
            kind: "category",
            name: "WiFi / Serial",
            colour: "#10B981",
            contents: [
                { kind: "block", type: "db_uart_begin" },
                { kind: "block", type: "db_uart_writeln", inputs: { TEXT: txt("AT") } },
                { kind: "block", type: "db_uart_write", inputs: { TEXT: txt("AT") } },
                { kind: "block", type: "db_uart_read", inputs: { MS: num(2000) } },
                { kind: "block", type: "db_uart_end" },
            ],
        },
        {
            kind: "category",
            name: "Functions",
            colour: "#9C5BD1",
            contents: [
                { kind: "block", type: "db_func_define" },
                { kind: "block", type: "db_func_call" },
            ],
        },
        {
            kind: "category",
            name: "Lists",
            colour: "#2FA1A6",
            contents: [
                { kind: "block", type: "db_list_add", inputs: { VALUE: num(0) } },
                { kind: "block", type: "db_list_get", inputs: { INDEX: num(1) } },
                { kind: "block", type: "db_list_set", inputs: { INDEX: num(1), VALUE: num(0) } },
                { kind: "block", type: "db_list_foreach" },
                { kind: "block", type: "db_list_length" },
                { kind: "block", type: "db_list_clear" },
            ],
        },
        {
            kind: "category",
            name: "Files",
            colour: "#B07D3C",
            contents: [
                { kind: "block", type: "db_pick_file" },
                { kind: "block", type: "db_file_exists", inputs: { PATH: txt("/ext/apps_data/mydata.txt") } },
                { kind: "block", type: "db_file_read_line", inputs: { LINE: num(1), PATH: txt("/ext/apps_data/mydata.txt") } },
                { kind: "block", type: "db_file_line_count", inputs: { PATH: txt("/ext/apps_data/mydata.txt") } },
                { kind: "block", type: "db_file_append_line", inputs: { TEXT: txt("hello"), PATH: txt("/ext/apps_data/mydata.txt") } },
                { kind: "block", type: "db_file_write", inputs: { TEXT: txt("hello"), PATH: txt("/ext/apps_data/mydata.txt") } },
                { kind: "block", type: "db_file_delete", inputs: { PATH: txt("/ext/apps_data/mydata.txt") } },
            ],
        },
    ],
};
