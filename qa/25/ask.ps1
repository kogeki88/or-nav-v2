# Types one question into the OR-Nav chat box on the test phone, presses Enter, waits, takes a screenshot.
param([string]$text, [string]$name, [int]$wait = 25)
$adb = 'C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb shell input tap 288 2232
Start-Sleep 1
$safe = $text.Replace("'", '').Replace(' ', '%s')
& $adb shell input text "'$safe'"
Start-Sleep 1
& $adb shell input keyevent 66
Start-Sleep $wait
& "C:\Users\igles\phone app\apps\or-nav-v2\qa\25\shot.ps1" -name $name
