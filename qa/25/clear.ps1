# Empties the OR-Nav chat box on the test phone: tap it, go to the end, delete 70 characters.
& 'C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell input tap 288 2232
Start-Sleep 1
& 'C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell input keyevent 123
$dels = (1..70 | ForEach-Object { '67' }) -join ' '
& 'C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell "input keyevent $dels"
