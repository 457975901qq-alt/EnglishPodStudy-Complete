$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$json = & "$PSScriptRoot\build-resource.ps1" -Root $root -Only 161,350,365
$catalog = $json | ConvertFrom-Json

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

Assert-Equal $catalog.count 3 'selected post-160 lessons are included'

$byNo = @{}
foreach ($lesson in $catalog.lessons) {
  $byNo[$lesson.no] = $lesson
}

Assert-Equal $byNo['0161'].id '0161' 'post-160 id is the four digit lesson number'
Assert-Equal $byNo['0161'].level 'Intermediate' 'post-160 estimated level is present'
Assert-Equal $byNo['0161'].levelCode 'C' 'post-160 estimated levelCode is present'
Assert-Equal $byNo['0161'].category 'Daily Life' 'category is parsed from titled series'
Assert-Equal $byNo['0161'].topic 'Computer Games' 'topic drops category prefix'

Assert-Null $byNo['0350'].category 'category is empty when title has no series'
Assert-Equal $byNo['0350'].topic 'Talking About Relatives' 'topic keeps plain title'

Assert-Equal $byNo['0365'].category 'Daily Life' 'late lesson category is parsed'
Assert-Equal $byNo['0365'].audio.lesson 'resource/0365/lesson.mp3' 'lesson audio is copied to fixed name'
