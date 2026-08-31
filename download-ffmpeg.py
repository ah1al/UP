"""
Video Pro — سكربت تنزيل ملفات ffmpeg محلياً
يجعل المشروع يعمل بدون أي CDN خارجي.

التشغيل:
    python download-ffmpeg.py
أو عبر الملف download-ffmpeg.bat

يُنزّل:
  lib/ffmpeg.js            (حزمة @ffmpeg/ffmpeg)
  lib/ffmpeg-core.js       (محرك ffmpeg-core)
"""
import os
import sys
import urllib.request
import ssl

BASE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(BASE, "lib")
os.makedirs(LIB, exist_ok=True)

FILES = [
    ("ffmpeg.js", "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js"),
    ("814.ffmpeg.js", "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/814.ffmpeg.js"),
    ("ffmpeg-core.js", "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"),
    ("ffmpeg-core.wasm", "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"),
]

# مصادر بديلة إن حُجب أحدها
FALLBACK = {
    "ffmpeg.js": "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js",
    "814.ffmpeg.js": "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/umd/814.ffmpeg.js",
    "ffmpeg-core.js": "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
    "ffmpeg-core.wasm": "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
}


def download(name, url):
    print(f"[*] تنزيل {name} ...")
    request = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=60, context=ctx) as resp:
        data = resp.read()
    dest = os.path.join(LIB, name)
    with open(dest, "wb") as f:
        f.write(data)
    print(f"    ✓ تم الحفظ ({len(data):,} bytes) -> lib/{name}")

    # تحقق من صحة الحزمة الرئيسية (النسخة الصحيحة تصدّر createFFmpeg و fetchFile)
    if name == "ffmpeg.js":
        text = data.decode("utf-8", errors="ignore")
        if "FFmpegWASM" in text and "writeFile" in text:
            print("    ✓ الحزمة سليمة (نسخة FFmpeg الحديثة)")
        elif "createFFmpeg" in text and "fetchFile" in text:
            print("    ✓ الحزمة سليمة (نسخة 0.12.x تُصدّر createFFmpeg)")
        else:
            print("    ⚠️ تحذير: الحزمة المحمّلة قد تكون نسخة غير متوقعة.")
    return True


def main():
    # حذف أي ملفات قديمة/خاطئة سابقة لضمان نظافة التنزيل
    for old in ["ffmpeg.js", "814.ffmpeg.js", "ffmpeg-core.js", "ffmpeg-core.wasm"]:
        p = os.path.join(LIB, old)
        if os.path.exists(p):
            os.remove(p)
            print(f"[..] حذف القديم: {old}")

    ok_all = True
    for name, url in FILES:
        try:
            download(name, url)
        except Exception as e:
            print(f"    ✗ فشل من unpkg: {e}")
            fb = FALLBACK.get(name)
            if fb:
                print(f"    محاولة من jsdelivr بديل...")
                try:
                    download(name, fb)
                except Exception as e2:
                    print(f"    ✗ فشل jsdelivr أيضاً: {e2}")
                    ok_all = False
            else:
                ok_all = False

    if ok_all:
        print("\n[OK] تم تنزيل كل ملفات ffmpeg بنجاح.")
        print("     افتح الصفحة الآن — ستعمل بدون إنترنت.")
    else:
        print("\n[!] فشل تنزيل بعض الملفات.")
        print("    تأكد من اتصالك بالإنترنت ثم أعد المحاولة،")
        print("    أو عطّل مانع الإعلانات في المتصفح.")
    input("\nاضغط Enter للخروج...")


if __name__ == "__main__":
    sys.exit(main())
