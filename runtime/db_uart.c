// Dolphin Blocks runtime — UART / WiFi dev board (ESP32) on the serial header.
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <furi_hal_serial.h>
#include <furi_hal_serial_control.h>
#include <string.h>

#define DB_UART_RX_BUF 512

static void db_uart_rx_cb(FuriHalSerialHandle* handle, FuriHalSerialRxEvent event, void* context) {
    DbCtx* ctx = context;
    if(event & FuriHalSerialRxEventData) {
        while(furi_hal_serial_async_rx_available(handle)) {
            uint8_t b = furi_hal_serial_async_rx(handle);
            if(ctx->uart_rx) {
                furi_stream_buffer_send(ctx->uart_rx, &b, 1, 0);
            }
        }
    }
}

bool db_uart_begin(DbCtx* ctx, uint32_t baud) {
    if(ctx->uart_handle) return true; // already open

    FuriHalSerialHandle* handle = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
    if(!handle) {
        db_print(ctx, "UART: port busy");
        return false;
    }
    furi_hal_serial_init(handle, baud);
    ctx->uart_rx = furi_stream_buffer_alloc(DB_UART_RX_BUF, 1);
    ctx->uart_handle = handle;
    furi_hal_serial_async_rx_start(handle, db_uart_rx_cb, ctx, false);
    return true;
}

void db_uart_end(DbCtx* ctx) {
    if(!ctx->uart_handle) return;
    FuriHalSerialHandle* handle = ctx->uart_handle;
    furi_hal_serial_async_rx_stop(handle);
    furi_hal_serial_deinit(handle);
    furi_hal_serial_control_release(handle);
    ctx->uart_handle = NULL;
    if(ctx->uart_rx) {
        furi_stream_buffer_free(ctx->uart_rx);
        ctx->uart_rx = NULL;
    }
}

void db_uart_write(DbCtx* ctx, const char* text) {
    if(!ctx->uart_handle || !text) return;
    furi_hal_serial_tx(ctx->uart_handle, (const uint8_t*)text, strlen(text));
    furi_hal_serial_tx_wait_complete(ctx->uart_handle);
}

void db_uart_writeln(DbCtx* ctx, const char* text) {
    db_uart_write(ctx, text);
    db_uart_write(ctx, "\r\n");
}

bool db_uart_read_line(DbCtx* ctx, uint32_t timeout_ms, char* out, size_t out_sz) {
    if(!ctx->uart_rx || !out || out_sz == 0) return false;
    size_t len = 0;
    uint32_t elapsed = 0;
    out[0] = '\0';

    while(elapsed < timeout_ms && !db_should_stop(ctx)) {
        uint8_t b;
        size_t n = furi_stream_buffer_receive(ctx->uart_rx, &b, 1, 20);
        if(n == 0) {
            elapsed += 20;
            continue;
        }
        if(b == '\n') {
            out[len] = '\0';
            return true;
        }
        if(b == '\r') continue;
        if(len < out_sz - 1) {
            out[len++] = (char)b;
            out[len] = '\0';
        }
    }
    return len > 0; // return partial line on timeout if we got anything
}
