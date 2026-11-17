// Dolphin Blocks runtime — Sub-GHz transmit (saved .sub files) and RSSI listen.
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <furi_hal.h>
#include <lib/subghz/devices/devices.h>
#include <lib/subghz/devices/preset.h>
#include <lib/subghz/transmitter.h>
#include <lib/subghz/environment.h>
#include <lib/subghz/subghz_file_encoder_worker.h>
#include <lib/subghz/subghz_protocol_registry.h>
#include <lib/subghz/devices/cc1101_int/cc1101_int_interconnect.h>
#include <lib/subghz/protocols/raw.h>
#include <flipper_format/flipper_format.h>
#include <storage/storage.h>
#include <string.h>

static FuriHalSubGhzPreset db_preset_from_name(const char* name) {
    if(!name) return FuriHalSubGhzPresetOok650Async;
    if(strcmp(name, "FuriHalSubGhzPresetOok270Async") == 0)
        return FuriHalSubGhzPresetOok270Async;
    if(strcmp(name, "FuriHalSubGhzPresetOok650Async") == 0)
        return FuriHalSubGhzPresetOok650Async;
    if(strcmp(name, "FuriHalSubGhzPreset2FSKDev238Async") == 0)
        return FuriHalSubGhzPreset2FSKDev238Async;
    if(strcmp(name, "FuriHalSubGhzPreset2FSKDev476Async") == 0)
        return FuriHalSubGhzPreset2FSKDev476Async;
    if(strcmp(name, "FuriHalSubGhzPresetMSK99_97KbAsync") == 0)
        return FuriHalSubGhzPresetMSK99_97KbAsync;
    if(strcmp(name, "FuriHalSubGhzPresetGFSK9_99KbAsync") == 0)
        return FuriHalSubGhzPresetGFSK9_99KbAsync;
    return FuriHalSubGhzPresetOok650Async;
}

bool db_subghz_send_file(DbCtx* ctx, const char* sub_path) {
    Storage* storage = furi_record_open(RECORD_STORAGE);
    FlipperFormat* ff = flipper_format_file_alloc(storage);

    FuriString* temp = furi_string_alloc();
    FuriString* preset_name = furi_string_alloc();
    FuriString* protocol = furi_string_alloc();
    uint32_t frequency = 0;
    bool ok = false;

    subghz_devices_init();
    const SubGhzDevice* device = subghz_devices_get_by_name(SUBGHZ_DEVICE_CC1101_INT_NAME);

    do {
        if(!device) {
            db_print(ctx, "SubGHz: no radio");
            break;
        }
        if(!flipper_format_file_open_existing(ff, sub_path)) {
            db_print(ctx, "SubGHz: file not found");
            break;
        }
        if(!flipper_format_read_string(ff, "Protocol", protocol)) {
            db_print(ctx, "SubGHz: no Protocol");
            break;
        }
        if(!flipper_format_read_uint32(ff, "Frequency", &frequency, 1)) {
            // Frequency may precede Protocol in file order; rewind and retry.
            flipper_format_rewind(ff);
            flipper_format_read_uint32(ff, "Frequency", &frequency, 1);
        }
        flipper_format_rewind(ff);
        flipper_format_read_string(ff, "Preset", preset_name);

        FuriHalSubGhzPreset preset =
            db_preset_from_name(furi_string_get_cstr(preset_name));

        subghz_devices_begin(device);
        subghz_devices_reset(device);
        subghz_devices_idle(device);
        subghz_devices_load_preset(device, preset, NULL);
        frequency = subghz_devices_set_frequency(device, frequency);

        if(furi_string_equal_str(protocol, SUBGHZ_PROTOCOL_RAW_NAME)) {
            // RAW: stream level/duration from the file.
            SubGhzFileEncoderWorker* enc = subghz_file_encoder_worker_alloc();
            if(subghz_file_encoder_worker_start(
                   enc, sub_path, SUBGHZ_DEVICE_CC1101_INT_NAME)) {
                furi_delay_ms(100); // let worker prime
                subghz_devices_start_async_tx(
                    device, subghz_file_encoder_worker_get_level_duration, enc);
                while(!subghz_devices_is_async_complete_tx(device) &&
                      !db_should_stop(ctx)) {
                    furi_delay_ms(20);
                }
                subghz_devices_stop_async_tx(device);
                subghz_file_encoder_worker_stop(enc);
                ok = true;
            } else {
                db_print(ctx, "SubGHz: RAW start fail");
            }
            subghz_file_encoder_worker_free(enc);
        } else {
            // Protocol: deserialize a transmitter and yield its upload.
            SubGhzEnvironment* env = subghz_environment_alloc();
            subghz_environment_set_protocol_registry(
                env, (void*)&subghz_protocol_registry);
            SubGhzTransmitter* tx =
                subghz_transmitter_alloc_init(env, furi_string_get_cstr(protocol));
            if(tx) {
                flipper_format_rewind(ff);
                SubGhzProtocolStatus st = subghz_transmitter_deserialize(tx, ff);
                if(st == SubGhzProtocolStatusOk) {
                    subghz_devices_start_async_tx(
                        device, subghz_transmitter_yield, tx);
                    while(!subghz_devices_is_async_complete_tx(device) &&
                          !db_should_stop(ctx)) {
                        furi_delay_ms(20);
                    }
                    subghz_devices_stop_async_tx(device);
                    ok = true;
                } else {
                    db_print(ctx, "SubGHz: decode fail");
                }
                subghz_transmitter_free(tx);
            } else {
                db_print(ctx, "SubGHz: unknown proto");
            }
            subghz_environment_free(env);
        }

        subghz_devices_idle(device);
        subghz_devices_sleep(device);
        subghz_devices_end(device);
    } while(false);

    subghz_devices_deinit();

    furi_string_free(temp);
    furi_string_free(preset_name);
    furi_string_free(protocol);
    flipper_format_free(ff);
    furi_record_close(RECORD_STORAGE);

    (void)frequency;
    return ok;
}

bool db_subghz_listen(DbCtx* ctx, uint32_t frequency, uint32_t timeout_ms) {
    subghz_devices_init();
    const SubGhzDevice* device = subghz_devices_get_by_name(SUBGHZ_DEVICE_CC1101_INT_NAME);
    if(!device) {
        db_print(ctx, "SubGHz: no radio");
        subghz_devices_deinit();
        return false;
    }

    subghz_devices_begin(device);
    subghz_devices_reset(device);
    subghz_devices_idle(device);
    subghz_devices_load_preset(device, FuriHalSubGhzPresetOok650Async, NULL);
    frequency = subghz_devices_set_frequency(device, frequency);
    subghz_devices_set_rx(device);

    bool seen = false;
    uint32_t elapsed = 0;
    while(elapsed < timeout_ms && !db_should_stop(ctx)) {
        float rssi = subghz_devices_get_rssi(device);
        if(rssi > -75.0f) { // squelch
            seen = true;
            break;
        }
        furi_delay_ms(20);
        elapsed += 20;
    }

    subghz_devices_idle(device);
    subghz_devices_sleep(device);
    subghz_devices_end(device);
    subghz_devices_deinit();
    return seen;
}
