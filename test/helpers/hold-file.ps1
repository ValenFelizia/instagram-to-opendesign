param([string]$FilePath, [string]$Checkpoint)
$heldFile = [System.IO.File]::Open($FilePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
try {
  [System.IO.File]::WriteAllText($Checkpoint, 'locked')
  Start-Sleep -Seconds 60
} finally { $heldFile.Dispose() }
