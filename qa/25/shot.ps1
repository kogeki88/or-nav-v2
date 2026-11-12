# Takes a test-phone screenshot into qa/25/<name>.png (two plain adb steps; no redirect).
param([string]$name)
& "C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe" shell screencap -p /sdcard/s.png
& "C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe" pull /sdcard/s.png "C:\Users\igles\phone app\apps\or-nav-v2\qa\25\$name.png" | Out-Null
"C:\Users\igles\phone app\apps\or-nav-v2\qa\25\$name.png"
