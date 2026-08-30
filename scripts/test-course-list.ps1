$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$path = Join-Path $root 'resource\course-list.json'
if (-not (Test-Path $path)) {
  throw "Missing course list JSON: $path"
}

$data = Get-Content $path -Raw | ConvertFrom-Json

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) {
    throw "$Message. Expected: <$Expected>; Actual: <$Actual>"
  }
}

function Assert-Null($Actual, [string]$Message) {
  if ($null -ne $Actual) {
    throw "$Message. Expected null; Actual: <$Actual>"
  }
}

Assert-Equal $data.count 365 'course list contains all lessons'
Assert-Equal $data.lessons[0].id '0001' 'course list is sorted by lesson number'
Assert-Equal $data.lessons[-1].id '0365' 'course list ends with the last lesson'
Assert-Equal $data.levels.Count 5 'level summary includes all difficulty groups in the source'
Assert-Equal $data.categories.Count 5 'category summary includes all topic groups in the source'

$byId = @{}
foreach ($lesson in $data.lessons) {
  $byId[$lesson.id] = $lesson
}

Assert-Equal $byId['0001'].number '0001' 'lesson number is present'
Assert-Equal $byId['0001'].title 'Difficult Customer' 'plain title is present'
Assert-Equal $byId['0001'].level 'Elementary' 'front section level is present'
Assert-Equal $byId['0001'].levelCode 'B' 'front section levelCode is present'
Assert-Null $byId['0001'].category 'front section category is empty'

Assert-Equal $byId['0161'].title 'Computer Games' 'post-160 title is present'
Assert-Equal $byId['0161'].displayTitle 'Daily Life - Computer Games' 'display title includes category'
Assert-Equal $byId['0161'].level 'Intermediate' 'post-160 estimated level is present'
Assert-Equal $byId['0161'].levelCode 'C' 'post-160 estimated levelCode is present'
Assert-Equal $byId['0161'].category 'Daily Life' 'post-160 category is present'
Assert-Equal $byId['0161'].resources.lesson 'resource/0161/lesson.mp3' 'lesson audio path is present'
Assert-Equal $byId['0161'].availability.worksheet $true 'worksheet availability is present'

$levelB = $data.levels | Where-Object code -eq 'B'
Assert-Equal $levelB.count 145 'level summary count is grouped by levelCode'

$dailyLife = $data.categories | Where-Object name -eq 'Daily Life'
Assert-Equal $dailyLife.count 88 'category summary count is grouped by category'
