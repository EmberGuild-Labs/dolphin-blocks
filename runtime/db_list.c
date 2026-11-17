// Dolphin Blocks runtime — number lists (bounds-safe array helpers).
#include "dolphin_blocks.h"

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
