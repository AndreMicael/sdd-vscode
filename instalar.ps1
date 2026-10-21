param(
  [string]$Vsix,
  # cursor, code ou vazio (instala nos dois que existirem)
  [string]$Editor
)

$repo = 'AndreMicael/sdd-vscode'
$paginaRelease = "https://github.com/$repo/releases/latest"
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Sair($mensagem) {
  Write-Host $mensagem -ForegroundColor Yellow
  Write-Host "Alternativa: baixe o .vsix em $paginaRelease e instale por Extensoes > ... > Install from VSIX."
  Start-Process $paginaRelease
  exit 1
}

# Token do GitHub: primeiro o login do git (o mesmo do git push), depois o do gh.
function ObterToken {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    # Pipe do PowerShell 5.1 para o git corrompe a entrada; o "<" do cmd com arquivo sem BOM funciona.
    $f = Join-Path $env:TEMP ('sdd-cred-' + [guid]::NewGuid() + '.txt')
    [IO.File]::WriteAllText($f, "protocol=https`nhost=github.com`n`n", (New-Object Text.UTF8Encoding $false))
    $saida = cmd /c "git credential fill < `"$f`" 2>nul"
    Remove-Item -LiteralPath $f -ErrorAction SilentlyContinue
    $linha = $saida | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
    if ($linha) { return $linha.Substring(9) }
  }
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    $t = gh auth token 2>$null
    if ($LASTEXITCODE -eq 0 -and $t) { return $t.Trim() }
  }
  return $null
}

$pasta = $null
if ($Vsix) {
  if (-not (Test-Path -LiteralPath $Vsix -PathType Leaf)) { Write-Host "Arquivo nao encontrado: $Vsix"; exit 1 }
  $arquivo = (Resolve-Path -LiteralPath $Vsix).Path
} else {
  Write-Host 'Procurando a ultima versao no GitHub...'
  $token = ObterToken
  if (-not $token) { Sair 'Nao achei login do GitHub. Faca login no git (ex.: git clone/push de um repo da Desenvolve-MT) e rode de novo.' }
  $cab = @{ Authorization = "Bearer $token"; 'User-Agent' = 'sdd-speckit-instalador' }
  try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $cab
  } catch {
    Sair "Nao consegui ler a ultima Release de $repo (sem acesso ao repositorio ou nenhuma Release publicada)."
  }
  $asset = $release.assets | Where-Object { $_.name -like 'sdd-speckit-*.vsix' } | Select-Object -First 1
  if (-not $asset) { Sair "A Release $($release.tag_name) nao tem o arquivo .vsix anexado." }

  $pasta = Join-Path $env:TEMP ('sdd-speckit-' + (Get-Date -Format 'yyyyMMddHHmmssfff'))
  New-Item -ItemType Directory -Path $pasta -Force | Out-Null
  $arquivo = Join-Path $pasta $asset.name
  Write-Host "Baixando $($asset.name) ($($release.tag_name))..."
  try {
    # O GitHub redireciona para o armazenamento; o .NET nao repassa o Authorization no redirecionamento.
    Invoke-WebRequest -Uri $asset.url -Headers ($cab + @{ Accept = 'application/octet-stream' }) -OutFile $arquivo -UseBasicParsing
  } catch {
    Remove-Item -LiteralPath $pasta -Recurse -Force -ErrorAction SilentlyContinue
    Sair "Falha ao baixar $($asset.name): $($_.Exception.Message)"
  }
}

$editores = if ($Editor) { @($Editor) } else { @('cursor', 'code') }
$instalado = $false
foreach ($e in $editores) {
  if (Get-Command $e -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = 'Continue'
    & $e --install-extension $arquivo --force 2>&1 | Where-Object { "$_" -notmatch 'Deprecat|trace-deprecation' }
    $instalado = $true
  }
}
if ($pasta) { Remove-Item -LiteralPath $pasta -Recurse -Force -ErrorAction SilentlyContinue }
if (-not $instalado) { Sair 'Nao encontrei o Cursor nem o VS Code no PATH.' }
Write-Host 'Pronto. Recarregue a janela do editor (Ctrl+Shift+P > Developer: Reload Window).' -ForegroundColor Green
