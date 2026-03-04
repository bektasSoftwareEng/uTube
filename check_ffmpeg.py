import shutil
import subprocess
import sys

def check_executable(name):
    # 1. Check if it's in the system PATH
    path = shutil.which(name)
    print(f"--- Checking {name.upper()} ---")
    if path:
        print(f"✅ Found in PATH at: {path}")
    else:
        print(f"❌ Not found in PATH.")
    
    # 2. Try to execute it to get the version
    try:
        result = subprocess.run([name, '-version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            # First line usually contains the version
            version_line = result.stdout.split('\n')[0]
            print(f"✅ Execution successful. Version info:\n   {version_line}\n")
        else:
            print(f"❌ Execution failed with return code {result.returncode}.\n   Error: {result.stderr}\n")
    except FileNotFoundError:
        print(f"❌ Could not execute '{name}'. The executable is not accessible.\n")
    except Exception as e:
        print(f"❌ Unexpected error while running '{name}': {e}\n")

if __name__ == "__main__":
    print(f"Python Executable: {sys.executable}\n")
    check_executable('ffmpeg')
    check_executable('ffprobe')
