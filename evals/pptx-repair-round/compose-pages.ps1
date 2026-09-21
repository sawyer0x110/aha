param(
    [Parameter(Mandatory = $true)][string]$ReviewDirectory,
    [ValidatePattern('^comparisons(?:-pixel-exact)?$')][string]$OutputName = 'comparisons'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ReviewDirectory).Path
Add-Type -AssemblyName System.Drawing
$font = [Drawing.Font]::new('Arial', 16)
$brush = [Drawing.SolidBrush]::new([Drawing.Color]::Black)
try {
    foreach ($case in @('git-merge', 'anc', 'greenland', 'aha-introduction')) {
        $caseRoot = Join-Path $root $case
        $destination = Join-Path $caseRoot $OutputName
        if (Test-Path -LiteralPath $destination) { throw "Refusing existing output: $destination" }
        $sources = @(
            @{ label = 'BEFORE'; path = (Join-Path $caseRoot 'before') },
            @{ label = 'A'; path = (Join-Path $caseRoot 'A\outputs') },
            @{ label = 'B'; path = (Join-Path $caseRoot 'B\outputs') }
        )
        $pages = @(Get-ChildItem -LiteralPath $sources[0].path -File |
            Where-Object { $_.Name -match '^slide-\d\d\.png$' } | Sort-Object Name)
        foreach ($source in $sources) {
            $names = @(Get-ChildItem -LiteralPath $source.path -File |
                Where-Object { $_.Name -match '^slide-\d\d\.png$' } | Sort-Object Name |
                Select-Object -ExpandProperty Name)
            if (($names -join ',') -cne (($pages.Name) -join ',')) {
                throw "Slide correspondence differs: $case/$($source.label); review mapping manually."
            }
        }
        $null = New-Item -ItemType Directory -Path $destination
        $records = [Collections.Generic.List[object]]::new()
        foreach ($page in $pages) {
            $canvas = [Drawing.Bitmap]::new(1600, 2796)
            $graphics = [Drawing.Graphics]::FromImage($canvas)
            $panels = [Collections.Generic.List[object]]::new()
            try {
                $graphics.Clear([Drawing.Color]::White)
                for ($index = 0; $index -lt $sources.Count; $index++) {
                    $source = $sources[$index]
                    $inputFile = Join-Path $source.path $page.Name
                    $image = [Drawing.Image]::FromFile($inputFile)
                    try {
                        if ($image.Width -ne 1600 -or $image.Height -ne 900) {
                            throw "Unexpected original export dimensions: $inputFile"
                        }
                        $top = $index * 932
                        $graphics.DrawString("$($source.label) | $($page.Name)", $font, $brush, 8, $top + 3)
                        # Explicit pixel rectangles avoid source/destination DPI scaling.
                        $graphics.DrawImage($image, [Drawing.Rectangle]::new(0, $top + 32, 1600, 900),
                            0, 0, 1600, 900, [Drawing.GraphicsUnit]::Pixel)
                        $panels.Add([ordered]@{
                            label = $source.label
                            source = $inputFile
                            sha256 = (Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash.ToLowerInvariant()
                            x = 0; y = $top + 32; width = 1600; height = 900
                        })
                    } finally { $image.Dispose() }
                }
                $outputFile = Join-Path $destination $page.Name
                $canvas.Save($outputFile, [Drawing.Imaging.ImageFormat]::Png)
                $records.Add([ordered]@{
                    image = $page.Name
                    sha256 = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
                    width = 1600; height = 2796
                    panels = @($panels.ToArray())
                })
            } finally { $graphics.Dispose(); $canvas.Dispose() }
        }
        [ordered]@{
            method = 'Original PowerPoint PNGs placed with explicit 1600x900 source/destination pixel rectangles, vertically stacked with separate BEFORE/A/B labels; no cropping or source-image modification.'
            purpose = 'One-image-at-a-time comparative inspection. Record visible facts immediately; an inaccessible or unreadable panel remains unverified.'
            slide_correspondence = 'Same numbered pages; this helper does not establish semantic page correspondence.'
            pages = @($records.ToArray())
        } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $destination 'image-provenance.json') -Encoding utf8
        Write-Output "$case`: $($pages.Count) comparative pages"
    }
} finally { $font.Dispose(); $brush.Dispose() }
