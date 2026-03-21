# home-security

## Node.js 環境のセットアップ

venv と同じ感覚でプロジェクト内に Node バージョンを固定できます。

### 初回セットアップ

```bash
bash setup.sh
```

- nvm がインストールされる
- このプロジェクト用の `.nvmrc` が生成される（Node バージョンを固定）
- 他のリポジトリには影響しない

---

## 日常の使い方（venv との対比）

| やること | Python (venv) | Node (nvm) |
|----------|---------------|------------|
| 環境を有効化 | `source .venv/bin/activate` | `nvm use` |
| パッケージ追加 | `pip install xxx` | `npm install xxx` |
| 環境を無効化 | `deactivate` | シェルを閉じるだけ |
| バージョン確認 | `python -V` | `node -v` |

### プロジェクトに入るとき

```bash
nvm use        # .nvmrc のバージョンに切り替え
npm install    # 依存関係インストール（node_modules/ はプロジェクト内に閉じる）
```

### 新しいターミナルを開いたら毎回 `nvm use` が必要

自動化したい場合は `~/.bashrc` に追加（任意）：

```bash
# .nvmrc があるディレクトリに入ったら自動で nvm use
cdnvm() {
  cd "$@" && [ -f .nvmrc ] && nvm use
}
alias cd=cdnvm
```

---

## 注意

- `npm install` → `node_modules/` 内に閉じる → **他に影響なし**
- `npm install -g` → グローバルインストール → **他プロジェクトに影響あり（なるべく使わない）**
