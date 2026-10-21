param(
  [string]$Vsix
)

$repo = 'Desenvolve-MT/sdd-vscode'
$url = 'https://github.com/Desenvolve-MT/sdd-vscode/releases/latest'

if (-not $Vsix -and -not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'GitHub CLI (gh) nao foi encontrado no PATH.'
  Write-Host 'Instale com: winget install GitHub.cli'
  Write-Host 'Alternativa: baixe o .vsix em https://github.com/Desenvolve-MT/sdd-vscode/releases/latest e instale por Extensoes > ... > Install from VSIX.'
  Start-Process $url
  exit 1
}

if ($Vsix) {
  $resolvido = Resolve-Path -LiteralPath $Vsix -ErrorAction SilentlyContinue
  if (-not $resolvido -or -not (Test-Path -LiteralPath $resolvido.Path -PathType Leaf)) {
    Write-Host "Arquivo VSIX nao encontrado: $Vsix"
    exit 1
  }
  $arquivo = $resolvido.Path
  $pasta = $null
} else {
  & gh auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    gh auth login
  }

  $pasta = Join-Path $env:TEMP ('sdd-speckit-' + (Get-Date -Format 'yyyyMMddHHmmssfff'))
  New-Item -ItemType Directory -Path $pasta -Force | Out-Null
  & gh release download -R $repo -p 'sdd-speckit-*.vsix' -D $pasta
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Nao foi possivel baixar a ultima versao da extensao.'
    Remove-Item -LiteralPath $pasta -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
  }
  $arquivos = @(Get-ChildItem -LiteralPath $pasta -Filter '*.vsix' -File)
  if ($arquivos.Count -ne 1) {
    Write-Host "Era esperado um unico .vsix, mas foram encontrados $($arquivos.Count)."
    Remove-Item -LiteralPath $pasta -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
  }
  $arquivo = $arquivos[0].FullName
}

$instalado = $false
foreach ($editor in @('cursor', 'code')) {
  if (Get-Command $editor -ErrorAction SilentlyContinue) {
    & $editor --install-extension $arquivo --force
    if ($editor -eq 'cursor') {
      Write-Host 'Instalado no Cursor'
    } else {
      Write-Host 'Instalado no VS Code'
    }
    $instalado = $true
  }
}
if (-not $instalado) {
  Write-Host 'Nenhum Cursor ou VS Code foi encontrado no PATH.'
}

Write-Host 'Recarregue a janela do editor (Ctrl+Shift+P > Developer: Reload Window).'
if ($pasta) {
  Remove-Item -LiteralPath $pasta -Recurse -Force -ErrorAction SilentlyContinue
}
