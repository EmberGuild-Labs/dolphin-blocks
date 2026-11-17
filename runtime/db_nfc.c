// Dolphin Blocks runtime — NFC read UID and emulate saved .nfc files.
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <nfc/nfc.h>
#include <nfc/nfc_scanner.h>
#include <nfc/nfc_poller.h>
#include <nfc/nfc_device.h>
#include <nfc/nfc_listener.h>
#include <nfc/protocols/nfc_generic_event.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    DbCtx* ctx;
    NfcPoller* poller;
    FuriEventFlag* flags;
    NfcProtocol protocol;
    char uid[32];
    bool detected;
    bool have_uid;
} DbNfcRead;

#define DB_NFC_DONE (1u << 0)

static void db_nfc_scanner_cb(NfcScannerEvent event, void* context) {
    DbNfcRead* r = context;
    if(event.type == NfcScannerEventTypeDetected && event.data.protocol_num > 0) {
        r->protocol = event.data.protocols[0];
        r->detected = true;
        furi_event_flag_set(r->flags, DB_NFC_DONE);
    }
}

static NfcCommand db_nfc_poller_cb(NfcGenericEventEx event, void* context) {
    UNUSED(event);
    DbNfcRead* r = context;
    const NfcDeviceData* data = nfc_poller_get_data(r->poller);
    if(data) {
        NfcDevice* dev = nfc_device_alloc();
        nfc_device_set_data(dev, r->protocol, data);
        size_t len = 0;
        const uint8_t* uid = nfc_device_get_uid(dev, &len);
        if(uid && len > 0) {
            int pos = 0;
            for(size_t i = 0; i < len && pos < (int)sizeof(r->uid) - 3; i++) {
                pos += snprintf(r->uid + pos, sizeof(r->uid) - pos, "%02X", uid[i]);
            }
            r->have_uid = true;
        }
        nfc_device_free(dev);
    }
    furi_event_flag_set(r->flags, DB_NFC_DONE);
    return NfcCommandStop;
}

bool db_nfc_read_uid(DbCtx* ctx, uint32_t timeout_ms, char* out_uid, size_t out_sz) {
    DbNfcRead r = {0};
    r.ctx = ctx;
    r.flags = furi_event_flag_alloc();

    Nfc* nfc = nfc_alloc();

    // Phase 1: detect which protocol is present.
    NfcScanner* scanner = nfc_scanner_alloc(nfc);
    nfc_scanner_start(scanner, db_nfc_scanner_cb, &r);

    uint32_t waited = 0;
    while(!r.detected && waited < timeout_ms && !db_should_stop(ctx)) {
        furi_event_flag_wait(r.flags, DB_NFC_DONE, FuriFlagWaitAny, 50);
        furi_event_flag_clear(r.flags, DB_NFC_DONE);
        waited += 50;
    }
    nfc_scanner_stop(scanner);
    nfc_scanner_free(scanner);

    // Phase 2: run a poller for that protocol to extract the UID.
    if(r.detected) {
        r.poller = nfc_poller_alloc(nfc, r.protocol);
        nfc_poller_start_ex(r.poller, db_nfc_poller_cb, &r);
        furi_event_flag_wait(r.flags, DB_NFC_DONE, FuriFlagWaitAny, 2000);
        nfc_poller_stop(r.poller);
        nfc_poller_free(r.poller);
    }

    nfc_free(nfc);
    furi_event_flag_free(r.flags);

    if(r.have_uid && out_uid && out_sz) {
        strncpy(out_uid, r.uid, out_sz - 1);
        out_uid[out_sz - 1] = '\0';
    }
    return r.have_uid;
}

typedef struct {
    DbCtx* ctx;
} DbNfcEmu;

static NfcCommand db_nfc_listener_cb(NfcGenericEvent event, void* context) {
    UNUSED(event);
    UNUSED(context);
    return NfcCommandContinue;
}

bool db_nfc_emulate_file(DbCtx* ctx, const char* nfc_path, uint32_t timeout_ms) {
    NfcDevice* device = nfc_device_alloc();
    if(!nfc_device_load(device, nfc_path)) {
        db_print(ctx, "NFC: file load fail");
        nfc_device_free(device);
        return false;
    }

    NfcProtocol protocol = nfc_device_get_protocol(device);
    const NfcDeviceData* data = nfc_device_get_data(device, protocol);

    Nfc* nfc = nfc_alloc();
    NfcListener* listener = nfc_listener_alloc(nfc, protocol, data);

    DbNfcEmu emu = {.ctx = ctx};
    nfc_listener_start(listener, db_nfc_listener_cb, &emu);

    uint32_t elapsed = 0;
    while(elapsed < timeout_ms && !db_should_stop(ctx)) {
        furi_delay_ms(50);
        elapsed += 50;
    }

    nfc_listener_stop(listener);
    nfc_listener_free(listener);
    nfc_free(nfc);
    nfc_device_free(device);
    return true;
}
