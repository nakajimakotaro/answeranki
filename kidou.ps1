# ----- 事前準備 -----

# Service AccountのJSONファイルのパス
$serviceAccountKeyPath = "myproject-448111-058c5b874dc4.json"

# Google Cloud プロジェクトID
$projectId = "myproject-448111"

# 起動するインスタンスの名前
$instanceName = "ubuntu-server-ssh-free" # 名前を少し変更 (任意)

# --- 無料枠の制約 ---
# 無料枠の e2-micro インスタンスは、以下の米国リージョンでのみ利用可能です:
# - us-west1 (オレゴン)
# - us-central1 (アイオワ)
# - us-east1 (サウスカロライナ)
# ここでは us-west1 のゾーンを指定します。
$zone = "us-west1-b" # 無料枠対象のゾーンに変更 (例: オレゴン)
# $zone = "us-central1-a" # 他の無料枠対象ゾーン (例: アイオワ)
# $zone = "us-east1-b"  # 他の無料枠対象ゾーン (例: サウスカロライナ)

# --- マシンタイプ ---
# 無料枠対象のマシンタイプ
$machineType = "e2-micro"

# インスタンスのOSイメージ (Ubuntuの最新LTS)
$imageFamily = "ubuntu-2404-lts-amd64"
$imageProject = "ubuntu-os-cloud"

# SSH接続に使用するユーザー名 (GCPが自動作成するユーザーとは別)
# このユーザー名で公開鍵がメタデータに登録されます
$sshUsername = "kotaro" # あなたのローカルマシンのユーザー名や任意の名前

# SSH公開鍵のパス (事前に生成しておく必要があります)
# 正しい絶対パスに修正してください
$publicKeyPath = "C:\Users\kotaro.nakajima\.ssh\id_ed25519_harusann2.pub"

# --- 注意 ---
# 無料枠では、1アカウントあたり1つの e2-micro インスタンスのみが無料対象となります。
# また、標準永続ディスクは30GB/月まで、ネットワーク下り（外向き）通信量も制限があります。
# これらを超過した場合や、静的IPアドレスを使用した場合などは料金が発生します。
# 最新の無料枠の詳細は必ずGoogle Cloudの公式ドキュメントで確認してください。
# https://cloud.google.com/free/docs/gcp-free-tier?hl=ja#compute

# ----- SSH公開鍵の内容を読み込む -----
try {
    # 公開鍵ファイルの内容を読み込み、前後の空白や改行を削除
    $publicKeyContent = (Get-Content -Path $publicKeyPath -Raw).Trim()
    # 公開鍵の形式を確認（簡単なチェック）
    # ed25519 以外 (rsaなど) の場合は、ここを修正してください
    if (-not (($publicKeyContent -like "ssh-ed25519 *") -or ($publicKeyContent -like "ssh-rsa *"))) {
        Write-Warning "指定されたSSH公開鍵ファイルの内容が期待される形式 (ssh-ed25519 または ssh-rsa) と異なる可能性があります: $publicKeyPath"
    }
} catch {
    Write-Error "SSH公開鍵ファイルが読み込めませんでした: $publicKeyPath - $($_.Exception.Message)"
    # エラーが発生したらスクリプトを終了
    exit 1
}

# メタデータ用の文字列を作成 (ユーザー名:鍵の内容)
$sshKeysMetadata = "$($sshUsername):$($publicKeyContent)"


# ----- 認証 -----

# Service Accountを使用してgcloudに認証
Write-Host "Service Account ($serviceAccountKeyPath) を使用して認証します..."
gcloud auth activate-service-account --key-file="$serviceAccountKeyPath" --project="$projectId"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Service Account での認証に失敗しました。"
    exit $LASTEXITCODE
}

# プロジェクトを設定
Write-Host "プロジェクト '$projectId' を設定します..."
gcloud config set project "$projectId"
if ($LASTEXITCODE -ne 0) {
    Write-Error "プロジェクトの設定に失敗しました。"
    exit $LASTEXITCODE
}

# デフォルトのゾーンを設定 (省略可能だが推奨)
Write-Host "デフォルトゾーンを '$zone' に設定します..."
gcloud config set compute/zone "$zone"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "デフォルトゾーンの設定に失敗しました。インスタンス作成は続行されますが、ゾーン指定が明示的になります。"
}

# ----- インスタンスの作成 -----

Write-Host "無料枠対象のインスタンス '$instanceName' をゾーン '$zone' に作成します..."
Write-Host "(マシンタイプ: $machineType, イメージ: $imageFamily from $imageProject)"

# --metadata オプションを使用してインスタンスを作成
gcloud compute instances create "$instanceName" `
    --zone="$zone" `
    --machine-type="$machineType" `
    --image-family="$imageFamily" `
    --image-project="$imageProject" `
    --boot-disk-size=10GB `
    --boot-disk-type=pd-standard `
    --metadata ssh-keys="$sshKeysMetadata" `
    --tags="http-server,https-server,ssh"

# 終了コードを確認
if ($LASTEXITCODE -ne 0) {
    Write-Error "インスタンスの作成に失敗しました。"
    # エラーが発生したらスクリプトを終了
    exit $LASTEXITCODE
}

# 作成されたインスタンスの情報を取得 (少し待機してから実行)
Write-Host "インスタンス情報を取得しています... (10秒待機)"
Start-Sleep -Seconds 10 # GCE APIが情報を更新するのを待つ

# インスタンス情報をJSON形式で取得し、PowerShellオブジェクトに変換
$instanceJson = gcloud compute instances describe "$instanceName" --zone="$zone" --format="json"
# describe コマンドが失敗した場合のエラーハンドリング
if ($LASTEXITCODE -ne 0) {
    Write-Warning "インスタンス情報の取得に失敗しました。gcloud describe コマンドがエラーを返しました。手動で確認してください。"
    # 失敗しても続行するか、ここで終了するか選択
    # exit $LASTEXITCODE
} else {
    $instance = $instanceJson | ConvertFrom-Json

    # 外部IPアドレスの取得
    # プロパティの存在確認をより丁寧に行う
    $externalIp = $null
    if ($instance -and $instance.networkInterfaces -and $instance.networkInterfaces.Count -gt 0) {
        # accessConfigs を持つ最初のネットワークインターフェースを探す
        $nicWithNatIP = $instance.networkInterfaces | Where-Object { $_.accessConfigs -and $_.accessConfigs.Count -gt 0 -and $_.accessConfigs[0].natIP } | Select-Object -First 1
        if ($nicWithNatIP) {
             $externalIp = $nicWithNatIP.accessConfigs[0].natIP
        }
    }

    if ($externalIp) {
        Write-Host "インスタンス '$instanceName' が作成されました。" -ForegroundColor Green
        Write-Host "外部IPアドレス: $externalIp"
        Write-Host "SSHで接続するには、以下のコマンドを実行してください (秘密鍵を指定する必要がある場合があります):"
        # 秘密鍵のパスはユーザーが知っている前提
        Write-Host "ssh -i C:\Users\kotaro.nakajima\.ssh\id_ed25519_harusann2 $sshUsername@$externalIp"
        # もし公開鍵に紐づくユーザー名でログインする場合
        # Write-Host "ssh $sshUsername@$externalIp"
    } else {
        Write-Warning "インスタンス情報の取得に成功しましたが、外部IPアドレスが見つかりませんでした。インスタンスのネットワーク設定を確認してください。"
        Write-Host "インスタンスの詳細:"
        Write-Output ($instance | ConvertTo-Json -Depth 5) # 詳細情報を表示
    }
}


# ----- ファイアウォールルールの設定 (SSH接続を許可) -----

# 既存のルールがあるか確認
# ターゲットタグ 'ssh' を持つインスタンスへのポート22 (SSH) を許可するルール
$firewallRuleName = "allow-ssh-from-any-tag-ssh" # ルール名を少し具体的に
$existingRule = $null
try {
    # --project は認証時に設定済みなので省略可能だが、明示的に指定しても良い
    $existingRule = gcloud compute firewall-rules describe "$firewallRuleName" --format="value(name)" 2>$null # エラー出力を抑制
} catch {
    # describe が見つからない場合にエラーを出す場合があるため、ここでは何もしない
}

if ($existingRule) {
    Write-Host "SSH接続を許可するファイアウォールルール '$firewallRuleName' は既に存在します。"
} else {
    Write-Host "SSH接続 (TCP:22) を許可するファイアウォールルール '$firewallRuleName' を作成します..."
    Write-Host "(対象: 'ssh' タグを持つインスタンス, 送信元: 全てのIPアドレス 0.0.0.0/0)"
    gcloud compute firewall-rules create "$firewallRuleName" `
        --allow=tcp:22 `
        --direction=INGRESS `
        --priority=1000 `
        --network=default `
        --source-ranges="0.0.0.0/0" `
        --target-tags="ssh" `
        --description="Allow SSH connections from any IP to instances with 'ssh' tag"
        # --project="$projectId" # 必要なら明示的に指定

    if ($LASTEXITCODE -eq 0) {
        Write-Host "ファイアウォールルール '$firewallRuleName' が作成されました。" -ForegroundColor Green
    } else {
        Write-Error "ファイアウォールルールの作成に失敗しました。"
        # ファイアウォールルール作成失敗はクリティカルではない場合もあるので、ここではスクリプトを止めない
    }
}

Write-Host "スクリプトの実行が完了しました。" -ForegroundColor Yellow
Write-Host "--- 注意 ---" -ForegroundColor Yellow
Write-Host "このインスタンスはGoogle Cloud無料枠の対象となるように設定されていますが、" -ForegroundColor Yellow
Write-Host "無料枠には制限 (インスタンス数、ディスクサイズ、通信量など) があります。" -ForegroundColor Yellow
Write-Host "必ず最新の公式ドキュメントで詳細を確認し、意図しない課金を避けてください。" -ForegroundColor Yellow
Write-Host "https://cloud.google.com/free/docs/gcp-free-tier?hl=ja#compute" -ForegroundColor Yellow