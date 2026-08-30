param(
  [string]$Root = (Resolve-Path "$PSScriptRoot\.."),
  [int[]]$Only   # optional: limit to specific lesson numbers (for preview)
)

$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$RootFull = (Resolve-Path $Root).Path
$ResourceDir = Join-Path $RootFull 'resource'

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

$levelWords    = @('newbie','elementary','intermediate','upper intermediate','upper-intermediate','advanced')
$categoryWords = @('daily life','global view','the office','the weekend','advanced media')

# Parse an ID3 title into { category, topic }, stripping level / type words.
function Parse-Title([string]$title) {
  $res = [ordered]@{ category = $null; topic = $null }
  if (-not $title) { return $res }
  $t = $title.Trim() -replace '\s*\((Fix|Review)\)\s*$', ''
  if ($t -match '\|') { $segs = $t -split '\|' }
  elseif ($t -match ' - ') { $segs = $t -split ' - ' }
  else { $segs = @($t) }
  $segs = $segs | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }

  $keep = @()
  foreach ($s in $segs) {
    $low = $s.ToLower()
    if ($levelWords -contains $low -or $low -eq 'dialog' -or $low -eq 'review') { continue }
    if ($categoryWords -contains $low) { $res.category = $s; continue }
    $keep += $s
  }
  if ($keep.Count -eq 0) { $keep = $segs }
  $res.topic = ($keep -join ' - ').Trim()
  return $res
}

function Rel([string]$path) {
  $path.Substring($RootFull.Length + 1) -replace '\\','/'
}

# Pre-index worksheet PDFs (english_pod/pdf, complete 365 set) by number
$pdfIndex = @{}
Get-ChildItem "$RootFull\english_pod\pdf" -Recurse -Filter *.pdf | ForEach-Object {
  if ($_.BaseName -match '(\d{4})$') { $pdfIndex[$matches[1]] = $_.FullName }
}

$lessonDirs = Get-ChildItem "$RootFull\englishpod365" -Directory |
  Where-Object { $_.Name -match '^\d{4}-\d{4}$' } |
  ForEach-Object { Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -match '^\d{4}$' } }

$lessons = @()
foreach ($dir in $lessonDirs) {
  $no  = $dir.Name
  $num = [int]$no
  if ($Only -and ($Only -notcontains $num)) { continue }

  $mp3s = Get-ChildItem $dir.FullName -Filter *.mp3
  if (-not $mp3s) { continue }

  $first = $mp3s[0]
  if ($first.BaseName -notmatch '_([A-Z]?)(\d{4})') { continue }
  $letter = if ($matches[1]) { $matches[1] } else { $null }
  if ($num -gt 160) { $letter = $null }
  $levelCode = if ($letter) { $letter } else { Get-LevelOverride $no }

  $dest = Join-Path $ResourceDir $no
  New-Item -ItemType Directory -Force -Path $dest | Out-Null

  # Copy MP3s under fixed names: dg=dialog, pb/pr=lesson, rv=review
  $audio = [ordered]@{ dialog = $null; lesson = $null; review = $null }
  foreach ($m in $mp3s) {
    $name = $null
    if ($m.BaseName -match 'dg$') { $name = 'dialog.mp3' }
    elseif ($m.BaseName -match '(pb|pr)$') { $name = 'lesson.mp3' }
    elseif ($m.BaseName -match 'rv$') { $name = 'review.mp3' }
    if ($name) {
      Copy-Item $m.FullName (Join-Path $dest $name) -Force
      $key = $name -replace '\.mp3$',''
      $audio[$key] = Rel (Join-Path $dest $name)
    }
  }

  # Topic from the main lesson file (pb/pr), fallback to first
  $mainFile = $mp3s | Where-Object { $_.BaseName -match '(pb|pr)$' } | Select-Object -First 1
  if (-not $mainFile) { $mainFile = $first }
  $titleParts = Parse-Title (Get-Mp3Title $mainFile)

  # Worksheet PDF (complete set from english_pod/pdf)
  $pdfRel = $null
  if ($pdfIndex.ContainsKey($no)) {
    Copy-Item $pdfIndex[$no] (Join-Path $dest 'worksheet.pdf') -Force
    $pdfRel = Rel (Join-Path $dest 'worksheet.pdf')
  }

  # Subtitle + transcript
  $srtSrc = "$RootFull\english_pod\srt\englishpod_$no.srt"
  $txtSrc = "$RootFull\english_pod\txt\englishpod_$no.txt"
  $srtRel = $null; $txtRel = $null
  if (Test-Path $srtSrc) { Copy-Item $srtSrc (Join-Path $dest 'subtitle.srt') -Force;   $srtRel = Rel (Join-Path $dest 'subtitle.srt') }
  if (Test-Path $txtSrc) { Copy-Item $txtSrc (Join-Path $dest 'transcript.txt') -Force; $txtRel = Rel (Join-Path $dest 'transcript.txt') }

  $lessons += [ordered]@{
    id        = $no
    no        = $no
    seq       = $num
    level     = if ($levelCode) { $levelNames[$levelCode] } else { $null }
    levelCode = $levelCode
    category  = $titleParts.category
    topic     = $titleParts.topic
    group     = $dir.Parent.Name
    audio     = $audio
    pdf       = $pdfRel
    subtitle  = [ordered]@{ srt = $srtRel; txt = $txtRel }
  }
}

$lessons = @($lessons | Sort-Object { $_['seq'] })

$courseLessons = @($lessons | ForEach-Object {
  $number = $_['no']
  $title = $_['topic']
  $category = $_['category']
  $audio = $_['audio']
  $subtitle = $_['subtitle']
  $resources = [ordered]@{
    dialog     = $audio['dialog']
    lesson     = $audio['lesson']
    review     = $audio['review']
    worksheet  = $_['pdf']
    host       = $null
    subtitle   = $subtitle['srt']
    transcript = $subtitle['txt']
  }

  [ordered]@{
    id           = $number
    number       = $number
    seq          = $_['seq']
    title        = $title
    displayTitle = if ($category) { "$category - $title" } else { $title }
    level        = $_['level']
    levelCode    = $_['levelCode']
    category     = $category
    group        = $_['group']
    section      = if ($_['seq'] -le 160) { 'level' } else { 'category' }
    resourceDir  = "resource/$number"
    resources    = $resources
    availability = [ordered]@{
      dialog     = [bool]$resources.dialog
      lesson     = [bool]$resources.lesson
      review     = [bool]$resources.review
      worksheet  = [bool]$resources.worksheet
      host       = [bool]$resources.host
      subtitle   = [bool]$resources.subtitle
      transcript = [bool]$resources.transcript
    }
  }
})

$result = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  count       = $lessons.Count
  levels      = $levelNames
  lessons     = $lessons
}

$courseList = [ordered]@{
  generatedAt = $result.generatedAt
  count       = $courseLessons.Count
  source      = 'resource/catalog.json'
  sections    = @(
    [ordered]@{
      name        = 'level'
      from        = '0001'
      to          = '0160'
      count       = @($courseLessons | Where-Object { $_['seq'] -le 160 }).Count
      description = 'Official levels are available for 0001-0160; later lessons use content-based estimates.'
    },
    [ordered]@{
      name        = 'category'
      from        = '0161'
      to          = '0365'
      count       = @($courseLessons | Where-Object { $_['seq'] -gt 160 }).Count
      description = 'Later lessons are organized by topic category; missing categories are null.'
    }
  )
  levels      = @($courseLessons |
    Where-Object { $_['levelCode'] } |
    Group-Object { $_['levelCode'] } |
    Sort-Object Name |
    ForEach-Object {
      [ordered]@{
        code  = $_.Name
        name  = $_.Group[0]['level']
        count = $_.Count
      }
    })
  categories  = @($courseLessons |
    Where-Object { $_['category'] } |
    Group-Object { $_['category'] } |
    Sort-Object Name |
    ForEach-Object {
      [ordered]@{
        name  = $_.Name
        count = $_.Count
      }
    })
  lessons     = $courseLessons
}

$json = $result | ConvertTo-Json -Depth 6
if ($Only) {
  Write-Output $json
} else {
  $outFile = Join-Path $ResourceDir 'catalog.json'
  $json | Set-Content -Path $outFile -Encoding UTF8
  $courseListFile = Join-Path $ResourceDir 'course-list.json'
  $courseList | ConvertTo-Json -Depth 8 | Set-Content -Path $courseListFile -Encoding UTF8
  Write-Output "Copied $($lessons.Count) lessons into $ResourceDir"
  Write-Output "Wrote catalog -> $outFile"
  Write-Output "Wrote course list -> $courseListFile"
}
