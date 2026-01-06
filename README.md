# Catanatron

[![Coverage Status](https://coveralls.io/repos/github/bcollazo/catanatron/badge.svg?branch=master)](https://coveralls.io/github/bcollazo/catanatron?branch=master)
[![Documentation Status](https://readthedocs.org/projects/catanatron/badge/?version=latest)](https://catanatron.readthedocs.io/en/latest/?badge=latest)
![Discord](https://img.shields.io/discord/1385302652014825552)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/bcollazo/catanatron/blob/master/examples/Overview.ipynb)

Catanatron は Settlers of Catan（カタンの開拓者たち）の高速シミュレーター兼強力な AI プレイヤーです。数千ゲーム規模のシミュレーションを数秒単位で回し、最強のカタンボットを探し出すことを目標としています。

詳細ドキュメント: https://docs.catanatron.com

コミュニティ Discord: https://discord.gg/FgFmb75TWd

## コマンドラインインターフェース
大規模なシミュレーションを回すための `catanatron-play` CLI ツールを同梱しています。

<p align="left">
 <img src="https://raw.githubusercontent.com/bcollazo/catanatron/master/docs/source/_static/cli.gif">
</p>

### インストール

1. リポジトリを取得します:

    ```bash
    git clone git@github.com:bcollazo/catanatron.git
    cd catanatron/
    ```
2. Python 3.11 以上で仮想環境を作成:

    ```bash
    python -m venv venv
    source ./venv/bin/activate
    ```
3. 依存関係をインストール:

    ```bash
    pip install -e .
    ```
4. （任意）Web UI や Gym、開発向けの依存関係:

    ```bash
    pip install -e ".[web,gym,dev]"
    ```

### 使い方

CLI からシミュレーションやデータセット生成を実行できます:

```bash
catanatron-play --players=R,R,R,W --num=100
```

ゲーム結果をファイルに出力して解析する例:
```bash
catanatron-play --num 100 --output my-data-path/ --output-format json
```

追加の使い方は https://docs.catanatron.com を参照してください。


## グラフィカルユーザーインターフェース

Docker で Web UI を起動し、Catanatron 対戦や観戦ができます。

<p align="left">
 <img src="https://raw.githubusercontent.com/bcollazo/catanatron/master/docs/source/_static/CatanatronUI.png">
</p>


### 起動手順

1. Docker をインストール（https://docs.docker.com/engine/install/）
2. リポジトリ直下で `docker-compose.yaml` を実行:

    ```bash
    docker compose up
    ```
3. ブラウザで http://localhost:3000 を開きます。

### ChatGPT 交渉アドバイス

Web UI 右側のドロワーに「交渉アドバイス」ボタンが追加されています。現在の盤面と行動ログを ChatGPT API に送り、トレードや交渉のヒントを取得します。利用するには API サーバーを起動する環境に以下の環境変数を設定してください:

| 変数 | 説明 |
| --- | --- |
| `OPENAI_API_KEY` | 必須。ChatGPT（OpenAI API）のキー。 |
| `NEGOTIATION_ADVICE_MODEL` | 任意。利用するモデル名（未設定時は `OPENAI_MODEL` → `NEGOTIATION_ADVICE_FALLBACK_MODEL` の順に利用）。 |
| `NEGOTIATION_ADVICE_FALLBACK_MODEL` | 任意。指定モデルが利用不可だった場合に自動で使うバックアップ（デフォルト `gpt-4o-mini`）。 |
| `NEGOTIATION_ADVICE_TEMPERATURE` | 任意。応答の温度。デフォルト `0.4`。 |
| `NEGOTIATION_LOG_LIMIT` | 任意。プロンプトに含める直近行動ログの件数（デフォルト 32）。 |

キーが未設定の場合、このボタンはエラーメッセージを返します。
また、OpenAI 側で利用上限に達している場合は 429 エラー（insufficient_quota）になるため、課金状況や使用量を確認し、必要に応じて新しいキーを設定してください。

## Python ライブラリ

`catanatron` パッケージを直接利用して、カタンのコアロジックを Python から呼び出すこともできます。

```python
from catanatron import Game, RandomPlayer, Color

# シンプルな 4 人対戦を実行
players = [
    RandomPlayer(Color.RED),
    RandomPlayer(Color.BLUE),
    RandomPlayer(Color.WHITE),
    RandomPlayer(Color.ORANGE),
]
game = Game(players)
print(game.play())  # 勝利した色を返す
```

詳細は http://docs.catanatron.com を参照してください。

## Gymnasium インターフェース
強化学習向けに OpenAI Gym/Gymnasium 互換の環境も提供しています。

インストール:
```bash
pip install -e .[gym]
```

使用例:
```python
import random
import gymnasium
import catanatron.gym

env = gymnasium.make("catanatron/Catanatron-v0")
observation, info = env.reset()
for _ in range(1000):
    # your agent here (this takes random actions)
    action = random.choice(info["valid_actions"])

    observation, reward, terminated, truncated, info = env.step(action)
    done = terminated or truncated
    if done:
        observation, info = env.reset()
env.close()
```

詳しくは https://docs.catanatron.com へ。


## ドキュメント
完全版ドキュメント: https://docs.catanatron.com

## コントリビュート

Catanatron コアへ貢献する場合は開発用依存パッケージを入れ、次のテストを実行してください:

```bash
pip install .[web,gym,dev]
coverage run --source=catanatron -m pytest tests/ && coverage report
```

貢献の詳細は https://docs.catanatron.com にまとめています。

## 付録
プロジェクトの背景はこちら: [5 Ways NOT to Build a Catan AI](https://medium.com/@bcollazo2010/5-ways-not-to-build-a-catan-ai-e01bc491af17)（英語）。
