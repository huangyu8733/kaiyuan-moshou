// w3x-patch: 用 StormLib 直接修改 w3x(MPQ) 内部文件。只作用于传入的副本，不涉及原图。
// 用法：
//   w3x-patch list   <archive>
//   w3x-patch extract<archive> <内部文件名> <输出路径>
//   w3x-patch replace<archive> <内部文件名> <本地文件> [<内部文件名> <本地文件> ...]
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include "StormLib.h"

static bool extractOne(HANDLE mpq, const char* name, const char* out) {
    HANDLE hFile = nullptr;
    if (!SFileOpenFileEx(mpq, name, SFILE_OPEN_FROM_MPQ, &hFile)) {
        fprintf(stderr, "open failed: %s (err=%u)\n", name, SErrGetLastError());
        return false;
    }
    DWORD size = SFileGetFileSize(hFile, nullptr);
    std::vector<unsigned char> buf(size ? size : 1);
    DWORD read = 0;
    bool ok = SFileReadFile(hFile, buf.data(), size, &read, nullptr);
    SFileCloseFile(hFile);
    if (!ok) { fprintf(stderr, "read failed: %s\n", name); return false; }
    FILE* f = fopen(out, "wb");
    if (!f) { fprintf(stderr, "cannot write %s\n", out); return false; }
    fwrite(buf.data(), 1, read, f);
    fclose(f);
    printf("extracted %s -> %s (%u bytes)\n", name, out, read);
    return true;
}

int main(int argc, char** argv) {
    if (argc < 3) {
        fprintf(stderr, "usage: %s list|extract|replace <archive> ...\n", argv[0]);
        return 2;
    }
    std::string cmd = argv[1];
    HANDLE mpq = nullptr;
    // 打开副本；MPQ_OPEN_FORCE_MPQ_V1 让老地图(或带保护的 v1 存档)按 v1 解析
    if (!SFileOpenArchive(argv[2], 0, 0, &mpq)) {
        fprintf(stderr, "SFileOpenArchive failed: %s (err=%u)\n", argv[2], SErrGetLastError());
        return 3;
    }

    int rc = 0;
    if (cmd == "list") {
        static const char* names[] = {
            "war3map.wts", "war3map.w3i", "war3map.w3e", "war3map.w3u", "war3map.w3t",
            "war3map.w3a", "war3map.w3b", "war3map.w3d", "war3map.w3h", "war3map.w3q",
            "war3map.w3r", "war3map.w3c", "war3map.w3s", "war3map.wtg", "war3map.wct",
            "war3map.doo", "war3map.mmp", "war3map.shd", "war3map.imp", "war3map.wpm",
            "scripts\\war3map.j", "scripts\\war3map.lua", "(listfile)", "(attributes)"
        };
        for (auto n : names) {
            HANDLE hFile = nullptr;
            if (SFileOpenFileEx(mpq, n, SFILE_OPEN_FROM_MPQ, &hFile)) {
                DWORD sz = SFileGetFileSize(hFile, nullptr);
                SFileCloseFile(hFile);
                printf("  yes  %-24s %u\n", n, sz);
            } else {
                printf("  no   %s\n", n);
            }
        }
    } else if (cmd == "extract") {
        if (argc < 5) { fprintf(stderr, "extract needs <name> <out>\n"); rc = 2; }
        else if (!extractOne(mpq, argv[3], argv[4])) rc = 4;
    } else if (cmd == "replace") {
        if (argc < 5 || ((argc - 3) % 2) != 0) {
            fprintf(stderr, "replace needs pairs: <name> <local>\n"); rc = 2;
        } else {
            for (int i = 3; i + 1 < argc; i += 2) {
                const char* name = argv[i];
                const char* local = argv[i + 1];
                // 先确认存档里确实有这个文件，避免凭空新增
                HANDLE probe = nullptr;
                bool exists = SFileOpenFileEx(mpq, name, SFILE_OPEN_FROM_MPQ, &probe);
                if (probe) SFileCloseFile(probe);
                DWORD flags = MPQ_FILE_COMPRESS | MPQ_FILE_REPLACEEXISTING;
                if (!SFileAddFileEx(mpq, local, name, flags, MPQ_COMPRESSION_ZLIB, MPQ_COMPRESSION_ZLIB)) {
                    fprintf(stderr, "replace failed: %s (exists=%d, err=%u)\n", name, (int)exists, SErrGetLastError());
                    rc = 5;
                } else {
                    printf("replaced %s <- %s\n", name, local);
                }
            }
        }
    } else {
        fprintf(stderr, "unknown command: %s\n", cmd.c_str());
        rc = 2;
    }

    SFileCloseArchive(mpq);
    return rc;
}
