param(
    [Parameter(Mandatory = $true)][string]$InputDeck,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$inputPath = (Resolve-Path -LiteralPath $InputDeck).Path
if ([IO.Path]::GetExtension($inputPath) -ne '.pptx') { throw 'Expected a PPTX input.' }
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $outputPath) { throw 'Output directory must not already exist.' }
$null = New-Item -ItemType Directory -Path $outputPath
$beforeHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash
$app = $null
$deck = $null
$probe = $null
$observations = [Collections.Generic.List[object]]::new()
$edits = [Collections.Generic.List[object]]::new()

try {
    $app = New-Object -ComObject PowerPoint.Application
    $deck = $app.Presentations.Open($inputPath, -1, 0, 0)
    for ($i = 1; $i -le $deck.Slides.Count; $i++) {
        $slide = $deck.Slides.Item($i)
        $image = Join-Path $outputPath ('slide-{0:D2}.png' -f $i)
        $slide.Export($image, 'PNG', 1600, 900)
        $shapes = [Collections.Generic.List[object]]::new()
        foreach ($shape in $slide.Shapes) {
            $text = $null
            if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
                $text = $shape.TextFrame.TextRange.Text
            }
            $shapes.Add([ordered]@{
                id = $shape.Id
                name = $shape.Name
                type = [int]$shape.Type
                left = $shape.Left
                top = $shape.Top
                width = $shape.Width
                height = $shape.Height
                text = $text
                hasTable = $shape.HasTable -eq -1
                hasChart = $shape.HasChart -eq -1
            })
        }
        $observations.Add([ordered]@{ slide = $i; image = [IO.Path]::GetFileName($image); shapes = @($shapes.ToArray()) })
    }
    $deck.Close()
    $deck = $null

    Add-Type -AssemblyName System.Drawing
    for ($start = 0; $start -lt $observations.Count; $start += 4) {
        $sheet = [Drawing.Bitmap]::new(1600, 900)
        $graphics = [Drawing.Graphics]::FromImage($sheet)
        try {
            $graphics.Clear([Drawing.Color]::White)
            for ($offset = 0; $offset -lt 4 -and ($start + $offset) -lt $observations.Count; $offset++) {
                $image = [Drawing.Image]::FromFile((Join-Path $outputPath $observations[$start + $offset].image))
                try {
                    $graphics.DrawImage($image, [int](($offset % 2) * 800), [int]([Math]::Floor($offset / 2) * 450), 800, 450)
                } finally { $image.Dispose() }
            }
            $sheet.Save((Join-Path $outputPath ('contact-{0:D2}.png' -f (1 + [int]($start / 4)))), [Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $sheet.Dispose() }
    }

    $probePath = Join-Path $outputPath 'editing-probe.pptx'
    Copy-Item -LiteralPath $inputPath -Destination $probePath
    $probe = $app.Presentations.Open($probePath, 0, 0, 0)
    $didText = $false
    $didTable = $false
    $didChart = $false
    for ($i = 1; $i -le $probe.Slides.Count; $i++) {
        foreach ($shape in $probe.Slides.Item($i).Shapes) {
            if (-not $didText -and $shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
                $old = $shape.TextFrame.TextRange.Text
                $shape.TextFrame.TextRange.Text = $old + ' [edit probe]'
                $edits.Add([ordered]@{ slide = $i; id = $shape.Id; type = 'text'; before = $old; after = $shape.TextFrame.TextRange.Text })
                $didText = $true
            }
            if (-not $didTable -and $shape.HasTable -eq -1) {
                $cell = $shape.Table.Cell(1, 1).Shape.TextFrame.TextRange
                $old = $cell.Text
                $cell.Text = $old + ' [edit probe]'
                $edits.Add([ordered]@{ slide = $i; id = $shape.Id; type = 'table-cell'; row = 1; column = 1; before = $old; after = $cell.Text })
                $didTable = $true
            }
            if (-not $didChart -and $shape.HasChart -eq -1) {
                $shape.Chart.ChartData.Activate()
                $workbook = $shape.Chart.ChartData.Workbook
                try {
                    $worksheet = $workbook.Worksheets.Item(1)
                    if ($worksheet.UsedRange.Rows.Count -ne 3 -or $worksheet.UsedRange.Columns.Count -ne 2) {
                        throw 'Expected the two-category, single-series chart fixture range A1:B3.'
                    }
                    $cell = $worksheet.Cells.Item(2, 2)
                    $old = $cell.Value2
                    if ($old -isnot [double] -and $old -isnot [int]) { throw 'Expected a numeric chart data cell at B2 for these evaluation fixtures.' }
                    $changed = [double]$old + 1
                    $cell.Value2 = $changed
                    $sheetName = $worksheet.Name.Replace("'", "''")
                    $shape.Chart.SetSourceData("='$sheetName'!`$A`$1:`$B`$3", 2)
                    $shape.Chart.Refresh()
                    $edits.Add([ordered]@{ slide = $i; id = $shape.Id; type = 'chart-data'; row = 2; column = 2; before = $old; after = $changed; refresh = 'Explicit Chart.SetSourceData A1:B3, then workbook close/save' })
                    $didChart = $true
                } finally {
                    $workbook.Close($true)
                    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
                }
            }
        }
    }
    $probe.Save()
    $probe.Close()
    $probe = $app.Presentations.Open($probePath, 0, 0, 0)
    foreach ($edit in $edits) {
        $shape = @($probe.Slides.Item($edit.slide).Shapes | Where-Object { $_.Id -eq $edit.id })
        if ($shape.Count -ne 1) { throw 'Edited shape could not be relocated after reopening.' }
        $actual = if ($edit.type -eq 'text') {
            $shape[0].TextFrame.TextRange.Text
        } elseif ($edit.type -eq 'table-cell') {
            $shape[0].Table.Cell(1, 1).Shape.TextFrame.TextRange.Text
        } else {
            $shape[0].Chart.ChartData.Activate()
            $workbook = $shape[0].Chart.ChartData.Workbook
            try { $workbook.Worksheets.Item(1).Cells.Item($edit.row, $edit.column).Value2 }
            finally {
                $workbook.Close($false)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
            }
        }
        if ($actual -cne $edit.after) { throw 'Edit did not persist through save and reopen.' }
        $edit.persisted = $true
        $probe.Slides.Item($edit.slide).Export((Join-Path $outputPath ('edit-{0}-{1:D2}.png' -f $edit.type, $edit.slide)), 'PNG', 1600, 900)
    }
    $afterHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash
    if ($beforeHash -cne $afterHash) { throw 'Original deck changed during inspection.' }
    [ordered]@{
        application = 'Microsoft PowerPoint'
        version = $app.Version
        method = 'PowerPoint COM export and programmatic edits on a copy, saved and reopened'
        outputHash = $beforeHash.ToLowerInvariant()
        originalUnchanged = $true
        slides = @($observations.ToArray())
        edits = @($edits.ToArray())
        unperformed = @('Human comprehension', 'Manual editing usability', 'Visual judgment: exported images require separate review')
    } | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $outputPath 'powerpoint-observations.json') -Encoding utf8
} finally {
    if ($null -ne $probe) { $probe.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($probe) }
    if ($null -ne $deck) { $deck.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck) }
    # Do not quit an application that may also contain the user's presentations.
    if ($null -ne $app) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
}
