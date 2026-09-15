param(
  [Parameter(Mandatory=$true)][string]$Plan,
  [Parameter(Mandatory=$true)][string]$Audio,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$planValue = Get-Content -LiteralPath $Plan -Raw | ConvertFrom-Json
$recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
  Where-Object { $_.Culture.Name -eq 'en-US' } | Select-Object -First 1
if (-not $recognizer) { throw 'No installed offline en-US recognizer.' }
if (Test-Path -LiteralPath $Output) { throw 'Output already exists.' }
$segments = @()
$inputDirectory = Join-Path (Split-Path -Parent $Output) ([IO.Path]::GetFileNameWithoutExtension($Output) + '-inputs')
New-Item -ItemType Directory -Path $inputDirectory | Out-Null
for ($index = 0; $index -lt $planValue.segments.Count; $index++) {
  $segment = $planValue.segments[$index]
  $file = Join-Path $Audio ('segment-{0:d3}.wav' -f ($index + 1))
  $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizer)
  try {
    $builder = [System.Speech.Recognition.GrammarBuilder]::new()
    $builder.Culture = $recognizer.Culture
    $builder.Append($segment.text)
    $engine.LoadGrammar([System.Speech.Recognition.Grammar]::new($builder))
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5)
    $engine.BabbleTimeout = [TimeSpan]::FromSeconds(20)
    $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromSeconds(2)
    $normalized = Join-Path $inputDirectory ('segment-{0:d3}.wav' -f ($index + 1))
    & ffmpeg -hide_banner -loglevel error -nostdin -n -i $file -ac 1 -ar 16000 -c:a pcm_s16le $normalized
    if ($LASTEXITCODE -ne 0) { throw "Could not normalize alignment input $file." }
    $engine.SetInputToWaveFile((Resolve-Path -LiteralPath $normalized).Path)
    $result = $engine.Recognize()
    if ($null -eq $result) { throw "No alignment for $($segment.id)." }
    $phraseStart = $result.Audio.AudioPosition.TotalSeconds
    $words = @($result.Words | ForEach-Object {
      $range = $result.GetAudioForWordRange($_, $_)
      @{
        word = $_.Text
        start = $phraseStart + $range.AudioPosition.TotalSeconds
        end = $phraseStart + $range.AudioPosition.TotalSeconds + $range.Duration.TotalSeconds
        confidence = $_.Confidence
      }
    })
    if ($words.Count -lt 2 -or $words[-1].start -le $words[0].start) { throw "Invalid word timing for $($segment.id)." }
    $segments += @{
      id = $segment.id
      narration = $segment.text
      recognizedText = $result.Text
      audioHash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
      phraseStart = $phraseStart
      confidence = $result.Confidence
      words = $words
    }
    Write-Host "$($segment.id): $($words.Count) words, confidence $($result.Confidence)"
  } finally {
    $engine.Dispose()
  }
}
@{
  method = 'Offline Windows Speech Recognition, exact narration grammar, temporary mono 16 kHz input. Word offsets obtained with GetAudioForWordRange relative to the recognized phrase start. Estimated times, not human-verified phonetic alignment.'
  recognizer = $recognizer.Id
  segments = $segments
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding utf8
