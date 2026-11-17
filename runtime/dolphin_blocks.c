// Dolphin Blocks runtime library — implementation.
// See dolphin_blocks.h for the API contract.

#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <furi_hal.h>
#include <furi_hal_random.h>
#include <gui/gui.h>
#include <input/input.h>
#include <notification/notification.h>
#include <notification/notification_messages.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// GUI drawing
// ---------------------------------------------------------------------------
static void db_draw_callback(Canvas* canvas, void* context) {
    DbCtx* ctx = context;
    furi_mutex_acquire(ctx->mutex, FuriWaitForever);

    canvas_clear(canvas);

    if(ctx->canvas_mode) {
        // Replay canvas ops
        canvas_set_color(canvas, ColorBlack);
        for(int i = 0; i < ctx->op_count; i++) {
            DbCanvasOp* op = &ctx->ops[i];
            switch(op->type) {
            case 0:
                canvas_set_font(canvas, FontSecondary);
                canvas_draw_str(canvas, op->a, op->b, op->text);
                break;
            case 1:
                if(op->filled)
                    canvas_draw_box(canvas, op->a, op->b, op->c, op->d);
                else
                    canvas_draw_frame(canvas, op->a, op->b, op->c, op->d);
                break;
            case 2: canvas_draw_dot(canvas, op->a, op->b); break;
            case 3: canvas_draw_line(canvas, op->a, op->b, op->c, op->d); break;
            }
        }
    } else {
        // Console: title bar + scrolling lines
        canvas_set_font(canvas, FontPrimary);
        canvas_draw_str(canvas, 2, 10, DOLPHIN_APP_NAME ? DOLPHIN_APP_NAME : "Dolphin Blocks");
        canvas_draw_line(canvas, 0, 12, 128, 12);
        canvas_set_font(canvas, FontSecondary);
        int y = 22;
        for(int i = 0; i < ctx->line_count; i++) {
            canvas_draw_str(canvas, 2, y, ctx->lines[i]);
            y += 9;
        }
    }

    furi_mutex_release(ctx->mutex);
}

static void db_input_callback(InputEvent* event, void* context) {
    DbCtx* ctx = context;
    DbButton b = DbBtnNone;
    switch(event->key) {
    case InputKeyUp: b = DbBtnUp; break;
    case InputKeyDown: b = DbBtnDown; break;
    case InputKeyLeft: b = DbBtnLeft; break;
    case InputKeyRight: b = DbBtnRight; break;
    case InputKeyOk: b = DbBtnOk; break;
    case InputKeyBack: b = DbBtnBack; break;
    default: break;
    }
    if(b == DbBtnNone) return;

    if(event->type == InputTypePress) {
        ctx->held |= (1u << b);
    } else if(event->type == InputTypeRelease) {
        ctx->held &= ~(1u << b);
    }

    // Long-press BACK requests stop.
    if(b == DbBtnBack && event->type == InputTypeLong) {
        ctx->should_stop = true;
    }

    if(event->type == InputTypeShort || event->type == InputTypePress) {
        DbButton copy = b;
        furi_message_queue_put(ctx->input_queue, &copy, 0);
    }
}

// ---------------------------------------------------------------------------
// Control flow
// ---------------------------------------------------------------------------
bool db_should_stop(DbCtx* ctx) {
    return ctx->should_stop;
}

bool db_delay(DbCtx* ctx, uint32_t ms) {
    const uint32_t step = 20;
    uint32_t elapsed = 0;
    while(elapsed < ms) {
        if(ctx->should_stop) return false;
        uint32_t chunk = (ms - elapsed) < step ? (ms - elapsed) : step;
        furi_delay_ms(chunk);
        elapsed += chunk;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Console / canvas
// ---------------------------------------------------------------------------
static void db_push_line(DbCtx* ctx, const char* text) {
    furi_mutex_acquire(ctx->mutex, FuriWaitForever);
    ctx->canvas_mode = false;
    if(ctx->line_count < DB_CONSOLE_LINES) {
        strncpy(ctx->lines[ctx->line_count], text, DB_LINE_LEN - 1);
        ctx->lines[ctx->line_count][DB_LINE_LEN - 1] = '\0';
        ctx->line_count++;
    } else {
        for(int i = 1; i < DB_CONSOLE_LINES; i++) {
            memcpy(ctx->lines[i - 1], ctx->lines[i], DB_LINE_LEN);
        }
        strncpy(ctx->lines[DB_CONSOLE_LINES - 1], text, DB_LINE_LEN - 1);
        ctx->lines[DB_CONSOLE_LINES - 1][DB_LINE_LEN - 1] = '\0';
    }
    furi_mutex_release(ctx->mutex);
    view_port_update(ctx->view_port);
}

void db_print(DbCtx* ctx, const char* text) {
    db_push_line(ctx, text ? text : "");
}

void db_print_int(DbCtx* ctx, const char* label, int value) {
    char buf[DB_LINE_LEN];
    snprintf(buf, sizeof(buf), "%s%d", label ? label : "", value);
    db_push_line(ctx, buf);
}

void db_print_num(DbCtx* ctx, const char* label, float value) {
    char buf[DB_LINE_LEN];
    snprintf(buf, sizeof(buf), "%s%.2f", label ? label : "", (double)value);
    db_push_line(ctx, buf);
}

void db_clear(DbCtx* ctx) {
    furi_mutex_acquire(ctx->mutex, FuriWaitForever);
    ctx->line_count = 0;
    ctx->op_count = 0;
    ctx->canvas_mode = false;
    furi_mutex_release(ctx->mutex);
    view_port_update(ctx->view_port);
}

static DbCanvasOp* db_new_op(DbCtx* ctx) {
    furi_mutex_acquire(ctx->mutex, FuriWaitForever);
    ctx->canvas_mode = true;
    DbCanvasOp* op = NULL;
    if(ctx->op_count < DB_CANVAS_OPS) {
        op = &ctx->ops[ctx->op_count++];
        memset(op, 0, sizeof(*op));
    }
    furi_mutex_release(ctx->mutex);
    return op;
}

void db_draw_text(DbCtx* ctx, int x, int y, const char* text) {
    DbCanvasOp* op = db_new_op(ctx);
    if(op) {
        op->type = 0;
        op->a = x;
        op->b = y;
        strncpy(op->text, text ? text : "", sizeof(op->text) - 1);
    }
    view_port_update(ctx->view_port);
}

void db_draw_box(DbCtx* ctx, int x, int y, int w, int h, bool filled) {
    DbCanvasOp* op = db_new_op(ctx);
    if(op) {
        op->type = 1;
        op->a = x;
        op->b = y;
        op->c = w;
        op->d = h;
        op->filled = filled;
    }
    view_port_update(ctx->view_port);
}

void db_draw_dot(DbCtx* ctx, int x, int y) {
    DbCanvasOp* op = db_new_op(ctx);
    if(op) {
        op->type = 2;
        op->a = x;
        op->b = y;
    }
    view_port_update(ctx->view_port);
}

void db_draw_line(DbCtx* ctx, int x0, int y0, int x1, int y1) {
    DbCanvasOp* op = db_new_op(ctx);
    if(op) {
        op->type = 3;
        op->a = x0;
        op->b = y0;
        op->c = x1;
        op->d = y1;
    }
    view_port_update(ctx->view_port);
}

void db_canvas_clear(DbCtx* ctx) {
    furi_mutex_acquire(ctx->mutex, FuriWaitForever);
    ctx->op_count = 0;
    ctx->canvas_mode = true;
    furi_mutex_release(ctx->mutex);
    view_port_update(ctx->view_port);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
bool db_button_pressed(DbCtx* ctx, DbButton btn) {
    if(btn >= DbBtnNone) return false;
    return (ctx->held & (1u << btn)) != 0;
}

DbButton db_button_wait(DbCtx* ctx) {
    DbButton b = DbBtnNone;
    while(!ctx->should_stop) {
        if(furi_message_queue_get(ctx->input_queue, &b, 50) == FuriStatusOk) {
            return b;
        }
    }
    return DbBtnNone;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
void db_led(DbCtx* ctx, uint8_t r, uint8_t g, uint8_t b) {
    NotificationMessage m_r = {.type = NotificationMessageTypeLedRed, .data.led.value = r};
    NotificationMessage m_g = {.type = NotificationMessageTypeLedGreen, .data.led.value = g};
    NotificationMessage m_b = {.type = NotificationMessageTypeLedBlue, .data.led.value = b};
    const NotificationMessage* seq[] = {&m_r, &m_g, &m_b, &message_do_not_reset, NULL};
    notification_message(ctx->notif, (const NotificationSequence*)&seq);
}

void db_led_off(DbCtx* ctx) {
    const NotificationMessage* seq[] = {
        &message_red_0, &message_green_0, &message_blue_0, NULL};
    notification_message(ctx->notif, (const NotificationSequence*)&seq);
}

void db_vibro(DbCtx* ctx, bool on) {
    const NotificationMessage* seq_on[] = {&message_vibro_on, &message_do_not_reset, NULL};
    const NotificationMessage* seq_off[] = {&message_vibro_off, NULL};
    const NotificationSequence* seq =
        on ? (const NotificationSequence*)&seq_on : (const NotificationSequence*)&seq_off;
    notification_message(ctx->notif, seq);
}

void db_beep(DbCtx* ctx) {
    db_tone(ctx, 880.0f, 80);
}

void db_tone(DbCtx* ctx, float freq_hz, uint32_t ms) {
    NotificationMessage m_on = {
        .type = NotificationMessageTypeSoundOn,
        .data.sound = {.frequency = freq_hz, .volume = 1.0f}};
    NotificationMessage m_delay = {
        .type = NotificationMessageTypeDelay, .data.delay.length = ms};
    const NotificationMessage* seq[] = {&m_on, &m_delay, &message_sound_off, NULL};
    notification_message_block(ctx->notif, (const NotificationSequence*)&seq);
}

void db_backlight(DbCtx* ctx, bool on) {
    const NotificationMessage* seq_on[] = {&message_display_backlight_on, NULL};
    const NotificationMessage* seq_off[] = {&message_display_backlight_off, NULL};
    const NotificationSequence* seq =
        on ? (const NotificationSequence*)&seq_on : (const NotificationSequence*)&seq_off;
    notification_message(ctx->notif, seq);
}

void db_success(DbCtx* ctx) {
    notification_message(ctx->notif, &sequence_success);
}

void db_error(DbCtx* ctx) {
    notification_message(ctx->notif, &sequence_error);
}

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------
int db_random(int min, int max) {
    if(min > max) {
        int t = min;
        min = max;
        max = t;
    }
    uint32_t span = (uint32_t)(max - min) + 1u;
    uint32_t r = furi_hal_random_get();
    return min + (int)(r % span);
}

// ---------------------------------------------------------------------------
// GPIO
// ---------------------------------------------------------------------------
static const GpioPin* db_pin(DbPin pin) {
    switch(pin) {
    case DbPin_PA7: return &gpio_ext_pa7;
    case DbPin_PA6: return &gpio_ext_pa6;
    case DbPin_PA4: return &gpio_ext_pa4;
    case DbPin_PB3: return &gpio_ext_pb3;
    case DbPin_PB2: return &gpio_ext_pb2;
    case DbPin_PC3: return &gpio_ext_pc3;
    case DbPin_PC1: return &gpio_ext_pc1;
    case DbPin_PC0: return &gpio_ext_pc0;
    default: return &gpio_ext_pa7;
    }
}

void db_gpio_mode_output(DbCtx* ctx, DbPin pin) {
    UNUSED(ctx);
    furi_hal_gpio_init(db_pin(pin), GpioModeOutputPushPull, GpioPullNo, GpioSpeedLow);
}

void db_gpio_mode_input(DbCtx* ctx, DbPin pin, bool pullup) {
    UNUSED(ctx);
    furi_hal_gpio_init(
        db_pin(pin), GpioModeInput, pullup ? GpioPullUp : GpioPullNo, GpioSpeedLow);
}

void db_gpio_write(DbCtx* ctx, DbPin pin, bool level) {
    UNUSED(ctx);
    furi_hal_gpio_write(db_pin(pin), level);
}

bool db_gpio_read(DbCtx* ctx, DbPin pin) {
    UNUSED(ctx);
    return furi_hal_gpio_read(db_pin(pin));
}

void db_pwm_start(DbCtx* ctx, uint32_t freq_hz, uint8_t duty_pct) {
    if(duty_pct > 100) duty_pct = 100;
    furi_hal_pwm_start(FuriHalPwmOutputIdLptim2PA4, freq_hz, duty_pct);
    ctx->pwm_running = true;
}

void db_pwm_stop(DbCtx* ctx) {
    if(ctx->pwm_running) {
        furi_hal_pwm_stop(FuriHalPwmOutputIdLptim2PA4);
        ctx->pwm_running = false;
    }
}

// ---------------------------------------------------------------------------
// Heavy subsystems (implemented in separate translation units to keep this
// file readable). Declared here; defined in db_ir.c, db_subghz.c, db_nfc.c,
// db_ble.c, db_uart.c.
// ---------------------------------------------------------------------------
// (prototypes already in header)

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------
typedef struct {
    DbCtx* ctx;
    FuriThread* thread;
} DbApp;

static int32_t db_program_thread(void* context) {
    DbCtx* ctx = context;
    dolphin_program(ctx);
    // After program finishes, wait for BACK so the user can read the screen.
    if(!ctx->should_stop) {
        db_print(ctx, "");
        db_print(ctx, "[ Done - press Back ]");
    }
    while(!ctx->should_stop) {
        furi_delay_ms(50);
    }
    return 0;
}

int32_t dolphin_blocks_app(void* p) {
    UNUSED(p);

    DbCtx* ctx = malloc(sizeof(DbCtx));
    memset(ctx, 0, sizeof(DbCtx));

    ctx->mutex = furi_mutex_alloc(FuriMutexTypeNormal);
    ctx->input_queue = furi_message_queue_alloc(16, sizeof(DbButton));
    ctx->gui = furi_record_open(RECORD_GUI);
    ctx->notif = furi_record_open(RECORD_NOTIFICATION);

    ctx->view_port = view_port_alloc();
    view_port_draw_callback_set(ctx->view_port, db_draw_callback, ctx);
    view_port_input_callback_set(ctx->view_port, db_input_callback, ctx);
    gui_add_view_port(ctx->gui, ctx->view_port, GuiLayerFullscreen);

    db_print(ctx, "Ready. Hold Back to quit.");

    FuriThread* thread =
        furi_thread_alloc_ex("DolphinProgram", 4096, db_program_thread, ctx);
    furi_thread_start(thread);

    // Main thread: keep backlight on while running, exit when stop requested.
    while(!ctx->should_stop) {
        furi_delay_ms(50);
    }

    furi_thread_join(thread);
    furi_thread_free(thread);

    // Teardown — make sure hardware the program opened is released even if the
    // user forgot a matching "stop" block.
    db_pwm_stop(ctx);
    db_uart_end(ctx);
    db_ble_beacon_stop(ctx);
    gui_remove_view_port(ctx->gui, ctx->view_port);
    view_port_free(ctx->view_port);
    furi_record_close(RECORD_NOTIFICATION);
    furi_record_close(RECORD_GUI);
    furi_message_queue_free(ctx->input_queue);
    furi_mutex_free(ctx->mutex);
    free(ctx);
    return 0;
}
