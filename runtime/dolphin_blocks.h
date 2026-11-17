// Dolphin Blocks runtime library.
//
// This header is the contract that the visual block editor's C code generator
// targets. A generated app provides one function:
//
//     void dolphin_program(DbCtx* ctx);
//
// ...and the manifest/name. Everything else (UI, threading, hardware setup and
// teardown) lives in dolphin_blocks.c so generated code stays clean and small.
//
// The program runs on a worker thread. The main thread owns the GUI: a scrolling
// text console plus an optional "canvas" layer the program can draw on. Holding
// BACK asks the program to stop; long-running blocks (loops, waits) poll
// db_should_stop() so the app always exits responsively.

#pragma once

#include <furi.h>
#include <gui/gui.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct DbCtx DbCtx;

// ---------------------------------------------------------------------------
// Program entry point (provided by generated code)
// ---------------------------------------------------------------------------
void dolphin_program(DbCtx* ctx);

// The generated app sets this so the window title and manifest match. Defined
// in the generated source file.
extern const char* DOLPHIN_APP_NAME;

// ---------------------------------------------------------------------------
// Control flow / lifetime
// ---------------------------------------------------------------------------

// True once the user asked to quit (held BACK). Loops and waits must poll this.
bool db_should_stop(DbCtx* ctx);

// Sleep for ms, but wake early (returning false) if the user asked to stop.
// Returns true if the full delay elapsed.
bool db_delay(DbCtx* ctx, uint32_t ms);

// ---------------------------------------------------------------------------
// Screen: scrolling console + simple canvas drawing
// ---------------------------------------------------------------------------
void db_print(DbCtx* ctx, const char* text);          // append a line
void db_print_int(DbCtx* ctx, const char* label, int value);
void db_print_num(DbCtx* ctx, const char* label, float value);
void db_clear(DbCtx* ctx);                             // clear console + canvas

// Canvas layer (drawn over the console header). Coordinates 0..127 x 0..63.
void db_draw_text(DbCtx* ctx, int x, int y, const char* text);
void db_draw_box(DbCtx* ctx, int x, int y, int w, int h, bool filled);
void db_draw_dot(DbCtx* ctx, int x, int y);
void db_draw_line(DbCtx* ctx, int x0, int y0, int x1, int y1);
void db_canvas_clear(DbCtx* ctx);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
typedef enum {
    DbBtnUp = 0,
    DbBtnDown,
    DbBtnLeft,
    DbBtnRight,
    DbBtnOk,
    DbBtnBack,
    DbBtnNone,
} DbButton;

// Non-blocking: is this button currently held?
bool db_button_pressed(DbCtx* ctx, DbButton btn);

// Blocking: wait for any button press and return it (or DbBtnNone if stopping).
DbButton db_button_wait(DbCtx* ctx);

// ---------------------------------------------------------------------------
// Notifications: LED, vibro, sound, backlight
// ---------------------------------------------------------------------------
void db_led(DbCtx* ctx, uint8_t r, uint8_t g, uint8_t b);  // set RGB (0..255)
void db_led_off(DbCtx* ctx);
void db_vibro(DbCtx* ctx, bool on);
void db_beep(DbCtx* ctx);
void db_tone(DbCtx* ctx, float freq_hz, uint32_t ms);      // play a note
void db_backlight(DbCtx* ctx, bool on);
void db_success(DbCtx* ctx);                               // happy blink+sound
void db_error(DbCtx* ctx);                                 // error blink+sound

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------
int db_random(int min, int max);  // inclusive range, order-independent

// ---------------------------------------------------------------------------
// GPIO (the external header pins: a0..a7 names map to the Flipper GPIO pins)
// ---------------------------------------------------------------------------
typedef enum {
    DbPin_PA7 = 0, // pin 2
    DbPin_PA6,     // pin 3
    DbPin_PA4,     // pin 4
    DbPin_PB3,     // pin 5
    DbPin_PB2,     // pin 6
    DbPin_PC3,     // pin 7
    DbPin_PC1,     // pin 15
    DbPin_PC0,     // pin 16
    DbPin_COUNT,
} DbPin;

void db_gpio_mode_output(DbCtx* ctx, DbPin pin);
void db_gpio_mode_input(DbCtx* ctx, DbPin pin, bool pullup);
void db_gpio_write(DbCtx* ctx, DbPin pin, bool level);
bool db_gpio_read(DbCtx* ctx, DbPin pin);
void db_pwm_start(DbCtx* ctx, uint32_t freq_hz, uint8_t duty_pct); // on pin PA7
void db_pwm_stop(DbCtx* ctx);

// ---------------------------------------------------------------------------
// Infrared
// ---------------------------------------------------------------------------
// Send by named universal protocol: "NEC","NECext","Samsung32","RC5","RC6",
// "SIRC","SIRC15","SIRC20","Kaseikyo","RCA". addr/cmd are protocol values.
bool db_ir_send(DbCtx* ctx, const char* protocol, uint32_t address, uint32_t command);
// Send a saved .ir file button by name (file path + button name).
bool db_ir_send_file(DbCtx* ctx, const char* ir_path, const char* button_name);
// Receive one signal (blocks up to timeout_ms). Fills out_desc with a short
// human description and returns true if something was decoded.
bool db_ir_receive(DbCtx* ctx, uint32_t timeout_ms, char* out_desc, size_t out_sz);

// ---------------------------------------------------------------------------
// Sub-GHz (uses whichever radio is configured: internal CC1101 or external)
// ---------------------------------------------------------------------------
// Transmit a saved .sub file. Returns true on success.
bool db_subghz_send_file(DbCtx* ctx, const char* sub_path);
// Listen on a frequency for raw activity; reports RSSI peak. Returns true if
// signal energy was seen above the squelch during timeout_ms.
bool db_subghz_listen(DbCtx* ctx, uint32_t frequency, uint32_t timeout_ms);

// ---------------------------------------------------------------------------
// NFC
// ---------------------------------------------------------------------------
// Scan for a card and return its UID as a hex string. Blocks up to timeout_ms.
bool db_nfc_read_uid(DbCtx* ctx, uint32_t timeout_ms, char* out_uid, size_t out_sz);
// Emulate a saved .nfc file until stop or timeout. Returns true while emulating.
bool db_nfc_emulate_file(DbCtx* ctx, const char* nfc_path, uint32_t timeout_ms);

// ---------------------------------------------------------------------------
// Bluetooth LE broadcast (beacon)
//
// Note: the BLE HID keyboard profile is not available to external apps on this
// firmware, so Bluetooth here broadcasts a BLE advertisement the Flipper shows
// up as on a phone's Bluetooth scanner. This is fully supported from a FAP.
// ---------------------------------------------------------------------------
bool db_ble_beacon_name(DbCtx* ctx, const char* name); // advertise a device name (random MAC)
// Advertise a device name with a chosen MAC address ("AA:BB:CC:DD:EE:FF").
// Handy for Faraday-bag testing: set a known name + MAC, then watch it vanish
// from a phone's Bluetooth list when the Flipper is inside the bag.
bool db_ble_beacon_name_mac(DbCtx* ctx, const char* name, const char* mac);
bool db_ble_beacon_raw(DbCtx* ctx, const char* hex);   // advertise raw adv bytes (hex)
void db_ble_beacon_stop(DbCtx* ctx);

// ---------------------------------------------------------------------------
// UART / WiFi dev board (ESP32) on the serial header
// ---------------------------------------------------------------------------
bool db_uart_begin(DbCtx* ctx, uint32_t baud);
void db_uart_end(DbCtx* ctx);
void db_uart_write(DbCtx* ctx, const char* text);      // writes text as-is
void db_uart_writeln(DbCtx* ctx, const char* text);    // appends CRLF
// Read one line (up to timeout_ms). Returns true if a line was received.
bool db_uart_read_line(DbCtx* ctx, uint32_t timeout_ms, char* out, size_t out_sz);

// ---------------------------------------------------------------------------
// Lists (of numbers). Generated code declares `float L_x[DB_LIST_CAP]` + an int
// length; these helpers keep every access bounds-safe (1-based indices).
// ---------------------------------------------------------------------------
#define DB_LIST_CAP 64
void db_list_add(float* arr, int* len, int cap, float value);
float db_list_get(const float* arr, int len, int index1); // 0 if out of range
void db_list_set(float* arr, int len, int index1, float value); // ignored if OOR

// ---------------------------------------------------------------------------
// Files (SD card, under /ext/...). Simple, stateless helpers.
// ---------------------------------------------------------------------------
bool db_file_exists(DbCtx* ctx, const char* path);
// Read the Nth line (1-based) of a text file into out. Returns true if that
// line exists. Lines longer than out_sz are truncated.
bool db_file_read_line(DbCtx* ctx, const char* path, int line_no, char* out, size_t out_sz);
int db_file_line_count(DbCtx* ctx, const char* path);         // number of lines
bool db_file_append_line(DbCtx* ctx, const char* path, const char* text); // add a line
bool db_file_write(DbCtx* ctx, const char* path, const char* text);       // overwrite file
bool db_file_delete(DbCtx* ctx, const char* path);
// Open the Flipper's native file browser and return the chosen path (or "" if
// cancelled). `ext` filters by extension (e.g. ".ir", ".sub", or "*" for all).
// The returned string is valid until the next call to db_pick_file.
const char* db_pick_file(DbCtx* ctx, const char* start_dir, const char* ext);

#ifdef __cplusplus
}
#endif
