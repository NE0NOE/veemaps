$WshShell = New-Object -ComObject WScript.Shell
$desktopPaths = @(
    "C:\Users\Elder\Desktop",
    [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop),
    [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
)

foreach ($dir in $desktopPaths) {
    if ($dir -and (Test-Path $dir)) {
        $shortcutPath = Join-Path $dir "GeoTrilateracion.lnk"
        $shortcut = $WshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "c:\Users\Elder\Desktop\proyectos\mapas\iniciar.bat"
        $shortcut.WorkingDirectory = "c:\Users\Elder\Desktop\proyectos\mapas"
        $shortcut.IconLocation = "shell32.dll,13"
        $shortcut.Description = "GeoTrilateracion - Localizador y Mapas Offline"
        $shortcut.Save()
        Write-Host "Acceso directo creado en: $shortcutPath"
    }
}
