param(
  [string]$Root = (Resolve-Path "$PSScriptRoot\.."),
  [string]$Out  = "$PSScriptRoot\..\apps\web\public\catalog.json",
  [int[]]$Only   # optional: limit to specific lesson numbers (for preview)
)

$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$RootFull = (Resolve-Path $Root).Path

# Level letter -> level name (EnglishPod difficulty)
$levelNames = @{
  'A' = 'Newbie'
  'B' = 'Elementary'
  'C' = 'Intermediate'
  'D' = 'Upper Intermediate'
  'E' = 'Advanced'
  'F' = 'Special'
}
$levelOverridePath = Join-Path $RootFull 'resource\lesson-levels.json'
$levelOverrides = if (Test-Path $levelOverridePath) {
  Get-Content $levelOverridePath -Raw | ConvertFrom-Json
} else {
  $null
}

function Get-LevelOverride([string]$number) {
  if (-not $levelOverrides) { return $null }
  $property = $levelOverrides.PSObject.Properties[$number]
  if ($property) { return [string]$property.Value }
  return $null
}

function Get-Mp3Title($file) {
  $folder = $shell.Namespace($file.DirectoryName)
  $item   = $folder.ParseName($file.Name)
  ($folder.GetDetailsOf($item, 21)).Trim()   # field 21 = ID3 Title
}

# Extract the topic from an ID3 title, stripping level / type words.
function Clean-Topic([string]$title) {
  if (-not $title) { return $null }
  $t = $title.Trim()
  $t = $t -replace '\s*\((Fix|Review)\)\s*$', ''
  if ($t -match '\|') { $segs = $t -split '\|' }
  elseif ($t -match ' - ') { $segs = $t -split ' - ' }
  else { $segs = @($t) }
  $skip = @('newbie','elementary','intermediate','upper intermediate','upper-intermediate','advanced','dialog','review','')
  $keep = @()
  foreach ($s in $segs) { if ($skip -notcontains $s.Trim().ToLower()) { $keep += $s.Trim() } }
  if ($keep.Count -eq 0) { $keep = $segs | ForEach-Object { $_.Trim() } }
  ($keep -join ' - ').Trim()
}

function Rel([string]$path) {
  $path.Substring($RootFull.Length + 1) -replace '\\','/'
}

$lessonDirs = Get-ChildItem "$Root\englishpod365" -Directory |
  Where-Object { $_.Name -match '^\d{4}-\d{4}$' } |
  ForEach-Object { Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -match '^\d{4}$' } }

$lessons = @()
foreach ($dir in $lessonDirs) {
  $num = [int]$dir.Name
  if ($Only -and ($Only -notcontains $num)) { continue }

  $mp3s = Get-ChildItem $dir.FullName -Filter *.mp3
  if (-not $mp3s) { continue }

  $first = $mp3s[0]
  if ($first.BaseName -notmatch '_([A-Z]?)(\d{4})') { continue }
  $letter = $matches[1]
  if ($num -gt 160) { $letter = $null }
  $levelCode = if ($letter) { $letter } else { Get-LevelOverride $dir.Name }

  # Map audio files by suffix: dg=dialog, pb/pr=main lesson, rv=review
  $audio = @{}
  foreach ($m in $mp3s) {
    if ($m.BaseName -match '([a-z]+)$') {
      switch ($matches[1]) {
        'dg' { $audio['dialog'] = Rel $m.FullName }
        'pb' { $audio['lesson'] = Rel $m.FullName }
        'pr' { $audio['lesson'] = Rel $m.FullName }
        'rv' { $audio['review'] = Rel $m.FullName }
      }
    }
  }

  # Topic comes from the main lesson file (pb/pr), fallback to first
  $mainFile = $mp3s | Where-Object { $_.BaseName -match '(pb|pr)$' } | Select-Object -First 1
  if (-not $mainFile) { $mainFile = $first }
  $topic = Clean-Topic (Get-Mp3Title $mainFile)

  $pdf = Get-ChildItem $dir.FullName -Filter *.pdf | Select-Object -First 1
  $pdfRel = if ($pdf) { Rel $pdf.FullName } else { $null }

  $srt = "$Root\english_pod\srt\englishpod_$($dir.Name).srt"
  $txt = "$Root\english_pod\txt\englishpod_$($dir.Name).txt"

  $lessons += [ordered]@{
    id        = ('{0}{1}' -f $levelCode, $dir.Name)
    no        = $dir.Name
    seq       = $num
    level     = $levelNames[$levelCode]
    levelCode = $levelCode
    topic     = $topic
    group     = $dir.Parent.Name
    audio     = [ordered]@{
      dialog = $audio['dialog']
      lesson = $audio['lesson']
      review = $audio['review']
    }
    pdf       = $pdfRel
    subtitle  = [ordered]@{
      srt = if (Test-Path $srt) { Rel (Resolve-Path $srt).Path } else { $null }
      txt = if (Test-Path $txt) { Rel (Resolve-Path $txt).Path } else { $null }
    }
  }
}

$lessons = $lessons | Sort-Object seq
$result = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  count       = $lessons.Count
  levels      = $levelNames
  lessons     = $lessons
}

$json = $result | ConvertTo-Json -Depth 6
if ($Only) {
  Write-Output $json
} else {
  $json | Set-Content -Path $Out -Encoding UTF8
  Write-Output "Wrote $($lessons.Count) lessons to $Out"
}
