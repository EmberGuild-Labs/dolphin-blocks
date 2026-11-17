// Private shared definitions for the Dolphin Blocks runtime.
// Only the runtime .c files include this; generated program code does not.
#pragma once

#include "dolphin_blocks.h"
#include <furi.h>
#include <gui/gui.h>
#include <notification/notification.h>

#define DB_CONSOLE_LINES 7
#define DB_LINE_LEN      40
#define DB_CANVAS_OPS    64

typedef struct {
    uint8_t type; // 0 text, 1 box, 2 dot, 3 line
    int16_t a, b, c, d;
    bool filled;
    char text[24];
} DbCanvasOp;

struct DbCtx {
    Gui* gui;
    ViewPort* view_port;
    NotificationApp* notif;
    FuriMutex* mutex;

    char lines[DB_CONSOLE_LINES][DB_LINE_LEN];
    int line_count;

    DbCanvasOp ops[DB_CANVAS_OPS];
    int op_count;
    bool canvas_mode;

    volatile uint32_t held;
    FuriMessageQueue* input_queue;

    volatile bool should_stop;

    void* ir_worker;    // InfraredWorker*
    void* ble_profile;  // FuriHalBleProfileBase*
    void* bt;           // Bt*
    void* uart_handle;  // FuriHalSerialHandle*
    FuriStreamBuffer* uart_rx;
    bool pwm_running;
    volatile bool ble_connected;
};
