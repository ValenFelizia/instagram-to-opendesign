# Evidence processor

GitHub [#3](https://github.com/ValenFelizia/instagram-to-opendesign/issues/3) turns the normalized source from [#2](https://github.com/ValenFelizia/instagram-to-opendesign/issues/2) into a compact bundle for human or multimodal review. It collects observations; it does not infer brand rules.

```powershell
node bin/process-evidence.js data/<username>
```

The command writes `data/<username>/evidence/`:

- `contact-sheet.svg`: up to 24 representative images, starting with the avatar and cycling through posts before taking additional carousel images, with relative asset links and owner usernames.
- `captions.md`: all post captions with source links and timestamps.
- `review.json`: one editable record per image. Set `classification` to `brand-graphic`, `product-photo`, or `mixed`. Use `features.logo`, `features.overlay`, `features.cover`, `compositionGroup`, and `notes` to record visual observations. Null classification means unreviewed.
- `evidence.md`: compact human-readable references for the contact sheet selection, separating brand graphics from product photos and mixed images, naming collaborator authors, repeated composition groups, profile context, and copy corpus link.
- `evidence.json`: machine-readable index for later analysis.

Run the command once to create `review.json`, label the representative images while viewing the contact sheet and original assets, then run it again. Other indexed images can remain unreviewed. Existing labels survive regeneration; removed images leave the current index. The avatar is only a candidate mark until reviewed. An image with a product color is not evidence of a brand color solely because it appears often. The later analyzer must cite specific reviewed assets and state confidence.

All output remains under `data/`, which Git ignores. Real profile content must not be committed without rights to redistribute it. The contact sheet links to files in `../assets/`, so keep the bundle with its parent profile directory when sharing locally.
