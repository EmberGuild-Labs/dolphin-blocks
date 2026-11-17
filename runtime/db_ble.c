// Dolphin Blocks runtime — Bluetooth LE broadcast (beacon).
//
// The BLE HID keyboard profile is disabled for external apps on this firmware,
// so instead we use the exported "extra beacon" API to broadcast a BLE
// advertisement. On a phone's Bluetooth scanner the Flipper then shows up with
// the chosen name.
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <furi_hal_bt.h>
#include <furi_hal_random.h>
#include <string.h>

#define DB_ADV_MAX 31

// Parse "AA:BB:CC:DD:EE:FF" (any non-hex separators allowed) into 6 bytes.
// Returns true if exactly 6 bytes were read.
static bool db_parse_mac(const char* mac, uint8_t out[6]) {
    if(!mac) return false;
    int n = 0;
    int hi = -1;
    for(const char* p = mac; *p && n < 6; p++) {
        char c = *p;
        int v;
        if(c >= '0' && c <= '9')
            v = c - '0';
        else if(c >= 'a' && c <= 'f')
            v = c - 'a' + 10;
        else if(c >= 'A' && c <= 'F')
            v = c - 'A' + 10;
        else
            continue;
        if(hi < 0) {
            hi = v;
        } else {
            out[n++] = (uint8_t)((hi << 4) | v);
            hi = -1;
        }
    }
    return n == 6;
}

// Configure the beacon. If mac is NULL/invalid, a random address is used.
static void db_beacon_config(const uint8_t* mac) {
    GapExtraBeaconConfig config = {
        .min_adv_interval_ms = 100,
        .max_adv_interval_ms = 150,
        .adv_channel_map = GapAdvChannelMapAll,
        .adv_power_level = GapAdvPowerLevel_6dBm,
        .address_type = GapAddressTypeRandom,
        .address = {0},
    };
    if(mac) {
        memcpy(config.address, mac, sizeof(config.address));
    } else {
        for(size_t i = 0; i < sizeof(config.address); i++) {
            config.address[i] = (uint8_t)(furi_hal_random_get() & 0xFF);
        }
    }
    furi_hal_bt_extra_beacon_set_config(&config);
}

static bool db_beacon_send_mac(DbCtx* ctx, const uint8_t* data, uint8_t len, const uint8_t* mac) {
    if(len > DB_ADV_MAX) len = DB_ADV_MAX;
    if(furi_hal_bt_extra_beacon_is_active()) {
        furi_hal_bt_extra_beacon_stop();
    }
    db_beacon_config(mac);
    if(!furi_hal_bt_extra_beacon_set_data(data, len)) {
        db_print(ctx, "BLE: set data failed");
        return false;
    }
    if(!furi_hal_bt_extra_beacon_start()) {
        db_print(ctx, "BLE: start failed");
        return false;
    }
    return true;
}

static bool db_beacon_send(DbCtx* ctx, const uint8_t* data, uint8_t len) {
    return db_beacon_send_mac(ctx, data, len, NULL);
}

// Build a name advertisement into `data`; returns its length.
static uint8_t db_build_name_adv(const char* name, uint8_t* data) {
    uint8_t pos = 0;
    // AD: Flags (LE General Discoverable + BR/EDR not supported)
    data[pos++] = 0x02;
    data[pos++] = 0x01;
    data[pos++] = 0x06;
    // AD: Complete Local Name (0x09)
    uint8_t name_len = (uint8_t)strlen(name);
    uint8_t max_name = DB_ADV_MAX - pos - 2;
    if(name_len > max_name) name_len = max_name;
    data[pos++] = name_len + 1;
    data[pos++] = 0x09;
    memcpy(&data[pos], name, name_len);
    pos += name_len;
    return pos;
}

bool db_ble_beacon_name(DbCtx* ctx, const char* name) {
    if(!name) name = "Flipper";
    uint8_t data[DB_ADV_MAX];
    uint8_t pos = db_build_name_adv(name, data);
    bool ok = db_beacon_send(ctx, data, pos);
    if(ok) db_print(ctx, "BLE: broadcasting");
    return ok;
}

bool db_ble_beacon_name_mac(DbCtx* ctx, const char* name, const char* mac) {
    if(!name) name = "Flipper";
    uint8_t data[DB_ADV_MAX];
    uint8_t pos = db_build_name_adv(name, data);

    uint8_t mac_bytes[6];
    bool have_mac = db_parse_mac(mac, mac_bytes);
    if(!have_mac && mac && mac[0] != '\0') {
        db_print(ctx, "BLE: bad MAC, using random");
    }
    bool ok = db_beacon_send_mac(ctx, data, pos, have_mac ? mac_bytes : NULL);
    if(ok) {
        db_print(ctx, "BLE: broadcasting");
        if(have_mac) db_print(ctx, mac);
    }
    return ok;
}

bool db_ble_beacon_raw(DbCtx* ctx, const char* hex) {
    if(!hex) return false;
    uint8_t data[DB_ADV_MAX];
    uint8_t len = 0;
    int hi = -1;
    for(const char* p = hex; *p && len < DB_ADV_MAX; p++) {
        char c = *p;
        int v;
        if(c >= '0' && c <= '9')
            v = c - '0';
        else if(c >= 'a' && c <= 'f')
            v = c - 'a' + 10;
        else if(c >= 'A' && c <= 'F')
            v = c - 'A' + 10;
        else
            continue; // skip spaces, colons, etc.
        if(hi < 0) {
            hi = v;
        } else {
            data[len++] = (uint8_t)((hi << 4) | v);
            hi = -1;
        }
    }
    if(len == 0) {
        db_print(ctx, "BLE: empty hex");
        return false;
    }
    bool ok = db_beacon_send(ctx, data, len);
    if(ok) db_print(ctx, "BLE: broadcasting");
    return ok;
}

void db_ble_beacon_stop(DbCtx* ctx) {
    UNUSED(ctx);
    if(furi_hal_bt_extra_beacon_is_active()) {
        furi_hal_bt_extra_beacon_stop();
    }
}
