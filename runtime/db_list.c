// Dolphin Blocks runtime — number and text lists (bounds-safe array helpers).
#include "dolphin_blocks.h"
#include <string.h>

void db_list_add(float* arr, int* len, int cap, float value) {
    if(!arr || !len) return;
    if(*len < cap) {
        arr[*len] = value;
        (*len)++;
    }
}

float db_list_get(const float* arr, int len, int index1) {
    if(!arr) return 0.0f;
    int i = index1 - 1; // lists are 1-based for beginners
    if(i < 0 || i >= len) return 0.0f;
    return arr[i];
}

void db_list_set(float* arr, int len, int index1, float value) {
    if(!arr) return;
    int i = index1 - 1;
    if(i < 0 || i >= len) return;
    arr[i] = value;
}

// ---- Text lists ----

void db_tlist_add(char list[][DB_TLIST_STR], int* len, int cap, const char* value) {
    if(!list || !len || !value) return;
    if(*len < cap) {
        strncpy(list[*len], value, DB_TLIST_STR - 1);
        list[*len][DB_TLIST_STR - 1] = '\0';
        (*len)++;
    }
}

const char* db_tlist_get(char list[][DB_TLIST_STR], int len, int index1) {
    if(!list) return "";
    int i = index1 - 1;
    if(i < 0 || i >= len) return "";
    return list[i];
}

void db_tlist_set(char list[][DB_TLIST_STR], int len, int index1, const char* value) {
    if(!list || !value) return;
    int i = index1 - 1;
    if(i < 0 || i >= len) return;
    strncpy(list[i], value, DB_TLIST_STR - 1);
    list[i][DB_TLIST_STR - 1] = '\0';
}
