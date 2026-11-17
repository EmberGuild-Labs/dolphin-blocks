// Dolphin Blocks runtime — Infrared.
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <infrared.h>
#include <infrared_transmit.h>
#include <infrared_worker.h>
#include <flipper_format/flipper_format.h>
#include <storage/storage.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

bool db_ir_send(DbCtx* ctx, const char* protocol, uint32_t address, uint32_t command) {
    InfraredProtocol proto = infrared_get_protocol_by_name(protocol);
    if(proto == InfraredProtocolUnknown) {
        db_print(ctx, "IR: unknown protocol");
        return false;
    }
    InfraredMessage msg = {
        .protocol = proto, .address = address, .command = command, .repeat = false};
    infrared_send(&msg, 1);
    return true;
}

// The infrared_signal_* file API is disabled for external apps on this
// firmware, so parse the .ir file ourselves and transmit with the (enabled)
// infrared_send / infrared_send_raw_ext calls.
bool db_ir_send_file(DbCtx* ctx, const char* ir_path, const char* button_name) {
    Storage* storage = furi_record_open(RECORD_STORAGE);
    FlipperFormat* ff = flipper_format_file_alloc(storage);
    FuriString* tmp = furi_string_alloc();
    bool ok = false;

    do {
        if(!flipper_format_file_open_existing(ff, ir_path)) {
            db_print(ctx, "IR: file not found");
            break;
        }
        // Find the signal entry whose "name" matches the requested button.
        bool found = false;
        while(flipper_format_read_string(ff, "name", tmp)) {
            if(furi_string_equal_str(tmp, button_name)) {
                found = true;
                break;
            }
        }
        if(!found) {
            db_print(ctx, "IR: button not found");
            break;
        }

        if(!flipper_format_read_string(ff, "type", tmp)) break;

        if(furi_string_equal_str(tmp, "parsed")) {
            FuriString* proto = furi_string_alloc();
            uint8_t addr[8] = {0};
            uint8_t cmd[8] = {0};
            if(flipper_format_read_string(ff, "protocol", proto) &&
               flipper_format_read_hex(ff, "address", addr, 4) &&
               flipper_format_read_hex(ff, "command", cmd, 4)) {
                InfraredProtocol p =
                    infrared_get_protocol_by_name(furi_string_get_cstr(proto));
                if(p != InfraredProtocolUnknown) {
                    InfraredMessage msg = {
                        .protocol = p,
                        .address = addr[0] | ((uint32_t)addr[1] << 8) |
                                   ((uint32_t)addr[2] << 16) | ((uint32_t)addr[3] << 24),
                        .command = cmd[0] | ((uint32_t)cmd[1] << 8) |
                                   ((uint32_t)cmd[2] << 16) | ((uint32_t)cmd[3] << 24),
                        .repeat = false};
                    infrared_send(&msg, 1);
                    ok = true;
                } else {
                    db_print(ctx, "IR: bad protocol");
                }
            }
            furi_string_free(proto);
        } else if(furi_string_equal_str(tmp, "raw")) {
            uint32_t freq = 38000;
            float duty = 0.33f;
            flipper_format_read_uint32(ff, "frequency", &freq, 1);
            flipper_format_read_float(ff, "duty_cycle", &duty, 1);
            uint32_t count = 0;
            if(flipper_format_get_value_count(ff, "data", &count) && count > 0) {
                uint32_t* timings = malloc(sizeof(uint32_t) * count);
                if(timings && flipper_format_read_uint32(ff, "data", timings, count)) {
                    infrared_send_raw_ext(timings, count, true, freq, duty);
                    ok = true;
                }
                if(timings) free(timings);
            }
        } else {
            db_print(ctx, "IR: unknown type");
        }
    } while(false);

    furi_string_free(tmp);
    flipper_format_free(ff);
    furi_record_close(RECORD_STORAGE);
    return ok;
}

typedef struct {
    FuriMessageQueue* queue;
    char desc[48];
    bool got;
} DbIrRx;

static void db_ir_rx_cb(void* context, InfraredWorkerSignal* signal) {
    DbIrRx* rx = context;
    if(infrared_worker_signal_is_decoded(signal)) {
        const InfraredMessage* m = infrared_worker_get_decoded_signal(signal);
        snprintf(
            rx->desc,
            sizeof(rx->desc),
            "%s A:%lX C:%lX",
            infrared_get_protocol_name(m->protocol),
            (unsigned long)m->address,
            (unsigned long)m->command);
    } else {
        snprintf(rx->desc, sizeof(rx->desc), "RAW signal");
    }
    rx->got = true;
}

bool db_ir_receive(DbCtx* ctx, uint32_t timeout_ms, char* out_desc, size_t out_sz) {
    DbIrRx rx = {0};
    InfraredWorker* worker = infrared_worker_alloc();
    infrared_worker_rx_set_received_signal_callback(worker, db_ir_rx_cb, &rx);
    infrared_worker_rx_enable_signal_decoding(worker, true);
    infrared_worker_rx_start(worker);

    uint32_t elapsed = 0;
    while(elapsed < timeout_ms && !rx.got && !db_should_stop(ctx)) {
        furi_delay_ms(20);
        elapsed += 20;
    }

    infrared_worker_rx_stop(worker);
    infrared_worker_free(worker);

    if(rx.got && out_desc && out_sz) {
        strncpy(out_desc, rx.desc, out_sz - 1);
        out_desc[out_sz - 1] = '\0';
    }
    return rx.got;
}
