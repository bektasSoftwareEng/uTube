import shutil
import subprocess
import sys
import importlib.util

def check_executable(name):
    print(f"\n--- Checking {name.upper()} ---")
    path = shutil.which(name)
    if not path:
        # Check anaconda path fallback
        conda_path = rf"C:\Users\emire\anaconda3\envs\uTube\Library\bin\{name}.exe"
        import os
        if os.path.exists(conda_path):
            path = conda_path
            print(f"⚠️ Not in PATH, but found in Conda env: {path}")
        else:
            print(f"❌ Not found anywhere.")
            return False
    else:
        print(f"✅ Found at: {path}")
    
    try:
        result = subprocess.run([path, '-version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(f"✅ Execution successful: {version_line}")
            return True
        else:
            print(f"❌ Execution failed (Return Code: {result.returncode})")
            print(f"   STDERR: {result.stderr.strip()[:200]}")
            return False
    except OSError as e:
        print(f"❌ OS Error executing {name}: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error executing {name}: {e}")
        return False

def check_package(name, import_name=None):
    if import_name is None:
        import_name = name
    print(f"--- Checking Python Package: {name} ---")
    spec = importlib.util.find_spec(import_name)
    if spec is not None:
        print(f"✅ Installed")
        return True
    else:
        print(f"❌ NOT Installed")
        return False

if __name__ == "__main__":
    print(f"Python Executable: {sys.executable}\n")
    
    ffmpeg_ok = check_executable('ffmpeg')
    ffprobe_ok = check_executable('ffprobe')
    
    print("\n")
    multipart_ok = check_package('python-multipart', 'multipart')
    moviepy_ok = check_package('moviepy')
    ffmpeg_python_ok = check_package('ffmpeg-python', 'ffmpeg')
    pathlib_ok = check_package('pathlib') # Built-in
    
    print("\n=== SUMMARY ===")
    if ffmpeg_ok and ffprobe_ok:
        print("✅ FFmpeg/FFprobe binaries are READY.")
    else:
        print("❌ FFmpeg/FFprobe binaries are FAILING or MISSING. (Likely DLL error 3221225785 in Conda)")
        print("   -> Fix: winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements")
