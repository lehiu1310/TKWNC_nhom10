param([int]$HueMismatchThreshold = 58)
$ErrorActionPreference = 'Stop'
$null = [Reflection.Assembly]::LoadWithPartialName('System.Drawing')
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$species = Get-Content -LiteralPath (Join-Path $root 'data/species.json') -Raw -Encoding utf8 | ConvertFrom-Json

function Get-HslHue([string]$Hex) {
  if ($Hex -notmatch '^#[0-9a-fA-F]{6}$') { return $null }
  $r=[Convert]::ToInt32($Hex.Substring(1,2),16)/255.0; $g=[Convert]::ToInt32($Hex.Substring(3,2),16)/255.0; $b=[Convert]::ToInt32($Hex.Substring(5,2),16)/255.0
  $max=[Math]::Max($r,[Math]::Max($g,$b)); $min=[Math]::Min($r,[Math]::Min($g,$b)); $d=$max-$min
  if ($d -lt 0.0001) { return $null }
  if ($max -eq $r) { $h=60*((($g-$b)/$d)%6) } elseif ($max -eq $g) { $h=60*(($b-$r)/$d+2) } else { $h=60*(($r-$g)/$d+4) }
  if ($h -lt 0) { $h += 360 }
  return $h
}

$results = foreach ($flower in $species) {
  $file = Join-Path $root $flower.image
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
  $bitmap = [System.Drawing.Bitmap]::new($file)
  try {
    $left=[int]($bitmap.Width*0.22); $right=[int]($bitmap.Width*0.78); $top=[int]($bitmap.Height*0.18); $bottom=[int]($bitmap.Height*0.82)
    $stepX=[Math]::Max(1,[int](($right-$left)/48)); $stepY=[Math]::Max(1,[int](($bottom-$top)/48))
    $bins=@{}
    for ($y=$top; $y -lt $bottom; $y+=$stepY) { for ($x=$left; $x -lt $right; $x+=$stepX) {
      $pixel=$bitmap.GetPixel($x,$y); $r=$pixel.R/255.0; $g=$pixel.G/255.0; $b=$pixel.B/255.0
      $max=[Math]::Max($r,[Math]::Max($g,$b)); $min=[Math]::Min($r,[Math]::Min($g,$b)); $delta=$max-$min
      if ($delta -lt 0.08 -or $max -lt 0.15 -or $max -gt 0.98) { continue }
      if ($max -eq $r) { $h=60*((($g-$b)/$delta)%6) } elseif ($max -eq $g) { $h=60*(($b-$r)/$delta+2) } else { $h=60*(($r-$g)/$delta+4) }
      if ($h -lt 0) { $h+=360 }
      # Green pixels are usually foliage/background, not petal color. Exclude
      # them from the dominant display-petal estimate while comparing hues.
      if ($h -ge 78 -and $h -le 165) { continue }
      $bin=[int][Math]::Floor($h/15); if (-not $bins.ContainsKey($bin)) { $bins[$bin]=[ordered]@{n=0;r=0;g=0;b=0} }
      $bins[$bin].n++; $bins[$bin].r+=$pixel.R; $bins[$bin].g+=$pixel.G; $bins[$bin].b+=$pixel.B
    } }
    if ($bins.Count -eq 0) { $photoColor=$flower.color; $sampleCount=0; $photoHue=Get-HslHue $photoColor }
    else {
      $dominant=$bins.GetEnumerator() | Sort-Object { $_.Value.n } -Descending | Select-Object -First 1
      $sampleCount=$dominant.Value.n; $pr=[int][Math]::Round($dominant.Value.r/$sampleCount); $pg=[int][Math]::Round($dominant.Value.g/$sampleCount); $pb=[int][Math]::Round($dominant.Value.b/$sampleCount)
      $photoColor=('#{0:X2}{1:X2}{2:X2}' -f $pr,$pg,$pb); $photoHue=($dominant.Name*15)+7.5
    }
    $speciesHue=Get-HslHue $flower.color
    $hueDelta=$null; if ($null -ne $speciesHue -and $null -ne $photoHue) { $raw=[Math]::Abs($speciesHue-$photoHue); $hueDelta=[Math]::Min($raw,360-$raw) }
    [pscustomobject]@{id=$flower.id; photo_color=$photoColor; photo_hue=[Math]::Round($photoHue,1); species_color=$flower.color; hue_difference=if($null -eq $hueDelta){$null}else{[Math]::Round($hueDelta,1)}; mismatch=($null -ne $hueDelta -and $hueDelta -gt $HueMismatchThreshold); samples=$sampleCount; image=$flower.image}
  } finally { $bitmap.Dispose() }
}
$output = Join-Path $root 'data/flower_photo_colors.json'
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $output -Encoding utf8
$missing=@($results | Where-Object { $_.samples -eq 0 }).Count
$mismatch=@($results | Where-Object mismatch).Count
"Analyzed $($results.Count) local species images; hue mismatches=$mismatch; insufficient saturated samples=$missing; threshold=${HueMismatchThreshold}deg"
