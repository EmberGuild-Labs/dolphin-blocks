// Dolphin Blocks runtime — files on the SD card (Flipper Storage API).
#include "dolphin_blocks_priv.h"

#include <furi.h>
#include <storage/storage.h>
#include <dialogs/dialogs.h>
#include <string.h>

#define DB_FILE_BUF 64

bool db_file_exists(DbCtx* ctx, const char* path) {
    UNUSED(ctx);
    Storage* storage = furi_record_open(RECORD_STORAGE);
    bool ok = storage_common_exists(storage, path);
    furi_record_close(RECORD_STORAGE);
    return ok;
}

bool db_file_read_line(DbCtx* ctx, const char* path, int line_no, char* out, size_t out_sz) {
    UNUSED(ctx);
    if(!out || out_sz == 0) return false;
    out[0] = '\0';
    if(line_no < 1) line_no = 1;

    Storage* storage = furi_record_open(RECORD_STORAGE);
    File* file = storage_file_alloc(storage);
    bool found = false;

    if(storage_file_open(file, path, FSAM_READ, FSOM_OPEN_EXISTING)) {
        uint8_t buf[DB_FILE_BUF];
        int cur = 1;
        size_t pos = 0;
        uint16_t n;
        bool done = false;
        while(!done && (n = storage_file_read(file, buf, sizeof(buf))) > 0) {
            for(uint16_t i = 0; i < n; i++) {
                char b = (char)buf[i];
                if(b == '\r') continue;
                if(b == '\n') {
                    if(cur == line_no) {
                        found = true;
                        done = true;
                        break;
                    }
                    cur++;
                    continue;
                }
                if(cur == line_no) {
                    found = true;
                    if(pos < out_sz - 1) {
                        out[pos++] = b;
                        out[pos] = '\0';
                    }
                }
            }
        }
    }

    storage_file_close(file);
    storage_file_free(file);
    furi_record_close(RECORD_STORAGE);
    return found;
}

int db_file_line_count(DbCtx* ctx, const char* path) {
    UNUSED(ctx);
    Storage* storage = furi_record_open(RECORD_STORAGE);
    File* file = storage_file_alloc(storage);
    int lines = 0;
    bool any = false;
    char last = '\0';

    if(storage_file_open(file, path, FSAM_READ, FSOM_OPEN_EXISTING)) {
        uint8_t buf[DB_FILE_BUF];
        uint16_t n;
        while((n = storage_file_read(file, buf, sizeof(buf))) > 0) {
            any = true;
            for(uint16_t i = 0; i < n; i++) {
                last = (char)buf[i];
                if(last == '\n') lines++;
            }
        }
    }

    storage_file_close(file);
    storage_file_free(file);
    furi_record_close(RECORD_STORAGE);

    // Count a final line that has content but no trailing newline.
    if(any && last != '\n') lines++;
    return lines;
}

static bool db_file_write_mode(const char* path, const char* text, bool append) {
    Storage* storage = furi_record_open(RECORD_STORAGE);
    File* file = storage_file_alloc(storage);
    bool ok = false;

    FS_OpenMode mode = append ? FSOM_OPEN_APPEND : FSOM_CREATE_ALWAYS;
    if(storage_file_open(file, path, FSAM_WRITE, mode)) {
        size_t len = strlen(text);
        uint16_t written = storage_file_write(file, text, len);
        ok = (written == len);
    }

    storage_file_close(file);
    storage_file_free(file);
    furi_record_close(RECORD_STORAGE);
    return ok;
}

bool db_file_append_line(DbCtx* ctx, const char* path, const char* text) {
    UNUSED(ctx);
    if(!text) text = "";
    bool ok = db_file_write_mode(path, text, true);
    if(ok) ok = db_file_write_mode(path, "\n", true);
    return ok;
}

bool db_file_write(DbCtx* ctx, const char* path, const char* text) {
    UNUSED(ctx);
    if(!text) text = "";
    return db_file_write_mode(path, text, false);
}

bool db_file_delete(DbCtx* ctx, const char* path) {
    UNUSED(ctx);
    Storage* storage = furi_record_open(RECORD_STORAGE);
    FS_Error err = storage_common_remove(storage, path);
    furi_record_close(RECORD_STORAGE);
    return err == FSE_OK;
}

const char* db_pick_file(DbCtx* ctx, const char* start_dir, const char* ext) {
    UNUSED(ctx);
    static char result[256];
    result[0] = '\0';

    DialogsApp* dialogs = furi_record_open(RECORD_DIALOGS);
    FuriString* start =
        furi_string_alloc_set(start_dir && start_dir[0] ? start_dir : "/ext");
    FuriString* chosen = furi_string_alloc();

    DialogsFileBrowserOptions options;
    dialog_file_browser_set_basic_options(
        &options, (ext && ext[0]) ? ext : "*", NULL);
    options.base_path = furi_string_get_cstr(start);
    options.hide_ext = false;

    bool ok = dialog_file_browser_show(dialogs, chosen, start, &options);
    if(ok) {
        strncpy(result, furi_string_get_cstr(chosen), sizeof(result) - 1);
        result[sizeof(result) - 1] = '\0';
    }

    furi_string_free(chosen);
    furi_string_free(start);
    furi_record_close(RECORD_DIALOGS);
    return result;
}
