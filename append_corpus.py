import sys

text_to_append = """
en|ja|Hello, how are you?|こんにちは、お元気ですか？
en|ja|Good morning!|おはようございます！
en|ja|Good evening.|こんばんは。
en|ja|What is your name?|お名前は何ですか？
en|ja|My name is Alex.|私の名前はアレックスです。
en|ja|Please help me.|助けてください。
en|ja|Where is the nearest hospital?|一番近い病院はどこですか？
en|ja|I would like a glass of water.|お水を一杯いただけますか。
en|ja|How much does this cost?|これはいくらですか？
en|ja|Thank you very much.|本当にありがとうございます。
en|ja|I don't understand.|わかりません。
en|ja|Can you speak more slowly?|もう少しゆっくり話していただけますか？

# Japanese idioms
en|ja|It's raining cats and dogs.|土砂降りだ。
en|ja|Break the ice.|場を和ませる。
en|ja|The ball is in your court.|次はあなたの番です。
en|ja|Spill the beans.|秘密を漏らす。
en|ja|Hit the nail on the head.|図星を指す。
en|ja|Piece of cake.|朝飯前。
en|ja|Under the weather.|体調が優れない。
en|ja|Cost an arm and a leg.|非常に高くつく。
"""

with open(r"d:\contestazam\geospeak\data\corpus.txt", "a", encoding="utf-8") as f:
    f.write(text_to_append)
